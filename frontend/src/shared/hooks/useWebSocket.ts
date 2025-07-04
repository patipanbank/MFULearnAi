import { useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useAuthStore, useChatStore, useUIStore } from '../stores';
import { config } from '../../config/config';
import type { ChatMessage } from '../stores/chatStore';

interface UseWebSocketOptions {
  chatId?: string;
  isInChatRoom: boolean;
}

export const useWebSocket = ({ chatId, isInChatRoom }: UseWebSocketOptions) => {
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  
  const currentSession = useChatStore((state) => state.currentSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setWsStatus = useChatStore((state) => state.setWsStatus);
  const setIsConnectedToRoom = useChatStore((state) => state.setIsConnectedToRoom);
  const setIsRoomCreating = useChatStore((state) => state.setIsRoomCreating);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);
  const setChatHistory = useChatStore((state) => state.setChatHistory);
  const chatHistory = useChatStore((state) => state.chatHistory);
  
  const addToast = useUIStore((state) => state.addToast);

  const wsRef = useRef<WebSocket | null>(null);
  const currentSessionRef = useRef<typeof currentSession>(null);
  const chatHistoryRef = useRef<any[]>([]);
  const pendingQueueRef = useRef<any[]>([]);
  const pendingFirstRef = useRef<{
    text: string;
    images: Array<{ url: string; mediaType: string }>;
    agentId?: string;
  } | null>(null);

  // Update refs when state changes - use useLayoutEffect to avoid extra renders
  useLayoutEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  useLayoutEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  // Helper function to check if token is expired
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < currentTime;
    } catch {
      return true;
    }
  }, []);

  // Helper to mark current streaming assistant as aborted
  const abortStreaming = useCallback((reason: string) => {
    const session = currentSessionRef.current;
    if (!session) return;
    const lastMsg = session.messages[session.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
      updateMessage(lastMsg.id, {
        content: lastMsg.content + `\n[${reason}]`,
        isStreaming: false,
        isComplete: true,
      });
    }
  }, [updateMessage]);

  // Handle room creation
  const handleRoomCreated = useCallback((roomId: string) => {
    console.log('Creating new chat room:', roomId);

    const session = currentSessionRef.current;
    if (session) {
      setCurrentSession({
        ...session,
        id: roomId,
      });

      if (roomId.length === 24) {
        setChatHistory([
          { ...session, id: roomId },
          ...chatHistoryRef.current.filter((chat: any) => chat.id !== session.id)
        ]);
      }
    }
    setIsRoomCreating(false);
  }, [setCurrentSession, setChatHistory, setIsRoomCreating]);

  // Helper function to try token refresh
  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Attempting to refresh token...');
      const newToken = await refreshToken();
      if (newToken) {
        console.log('Token refreshed successfully');
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }, [refreshToken]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (
      !token ||
      !currentSession ||
      (wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
         wsRef.current.readyState === WebSocket.CONNECTING))
    ) {
      return;
    }
    
    if (isTokenExpired(token)) {
      console.log('Token expired, attempting refresh...');
      tryRefreshToken().then((success) => {
        if (success) {
          // Close existing connection and let parent handle reconnection
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        }
      });
      return;
    }
    
    setWsStatus('connecting');
    
    let wsUrl = `${config.wsUrl}?token=${token}`;
    if (window.location.hostname === 'localhost') {
      wsUrl = `ws://localhost/ws?token=${token}`;
    }
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      setIsConnectedToRoom(true);
      
      if (isInChatRoom && chatId) {
        console.log('WebSocket: Joining room', chatId);
        ws.send(JSON.stringify({ type: 'join_room', chatId }));
      }
      
      console.log('[CHAT] WebSocket OPEN – pending', pendingQueueRef.current.length);
      pendingQueueRef.current.forEach((p) => {
        console.log('WebSocket: Sending pending message', p);
        ws.send(JSON.stringify(p));
      });
      pendingQueueRef.current = [];
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket: Received message', data);
        
        if (data.type === 'chunk') {
          const session = currentSessionRef.current;
          const lastMessage = session?.messages[session.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            updateMessage(lastMessage.id, {
              content: lastMessage.content + data.data
            });
          } else {
            const assistantMsg: ChatMessage = {
              id: Date.now().toString() + '_assistant',
              role: 'assistant',
              content: data.data,
              timestamp: new Date(),
              isStreaming: true,
              isComplete: false
            };
            addMessage(assistantMsg);
          }
        } else if (data.type === 'room_created') {
          console.log('WebSocket: Room created', data.data.chatId);
          handleRoomCreated(data.data.chatId);
          
          // ส่งข้อความแรกทันทีก่อน redirect
          if (pendingFirstRef.current) {
            const { text, images: pImages, agentId: pAgentId } = pendingFirstRef.current;
            const msgPayload = {
              type: 'message',
              chatId: data.data.chatId,
              text,
              images: pImages,
              agent_id: pAgentId
            };
            console.log('WebSocket: Sending first message', msgPayload);
            // ส่งข้อความทันที
            wsRef.current?.send(JSON.stringify(msgPayload));
            pendingFirstRef.current = null;
          }
          
          // ใช้ setTimeout เพื่อให้ข้อความถูกส่งก่อน redirect
          setTimeout(() => {
            // ใช้ window.location.href เพื่อให้ redirect ทำงานถูกต้อง
            window.location.href = `/chat/${data.data.chatId}`;
          }, 200);
        } else if (data.type === 'end') {
          console.log('WebSocket: Message ended');
          const session = currentSessionRef.current;
          const lastMessage = session?.messages[session.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            updateMessage(lastMessage.id, {
              isComplete: true,
              isStreaming: false
            });
          }
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.data);
          addToast({
            type: 'error',
            title: 'Chat Error',
            message: data.data
          });
          abortStreaming('ERROR');
        } else {
          console.debug('WS unhandled event', data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      abortStreaming('CONNECTION LOST');
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to connect to chat service. Retrying...',
        duration: 5000
      });
    };

    ws.onclose = async (event) => {
      console.warn('WebSocket closed', event);
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      setWsStatus('disconnected');
      setIsConnectedToRoom(false);
      
      if (event.code === 1000) {
        console.log('WebSocket closed normally');
      } else if (event.code === 1006) {
        console.log('WebSocket connection failed (code 1006)', { reason: event.reason });
        if (token && isTokenExpired(token)) {
          console.log('Connection failed due to expired token, attempting refresh...');
          tryRefreshToken();
        } else {
          setTimeout(() => {
            console.log('Attempting to reconnect...');
            // The parent component will handle reconnection
          }, 3000);
        }
      } else {
        console.log(`WebSocket closed with code ${event.code}:`, event.reason);
        addToast({
          type: 'warning',
          title: 'Connection Lost',
          message: 'Connection to chat service lost. Attempting to reconnect...',
          duration: 5000
        });
      }
    };
  }, [token, currentSession, isTokenExpired, setWsStatus, setIsConnectedToRoom, isInChatRoom, chatId, updateMessage, addMessage, setCurrentSession, setChatHistory, setIsRoomCreating, abortStreaming, addToast, tryRefreshToken, handleRoomCreated]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    wsRef,
    pendingFirstRef,
    pendingQueueRef,
    connectWebSocket,
    abortStreaming,
    isTokenExpired,
    tryRefreshToken
  };
}; 