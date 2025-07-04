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

  // แยก effect สำหรับการส่ง join_room
  useEffect(() => {
    if (currentSession && isInChatRoom && chatId && currentSession.id === chatId && currentSession.messages.length > 0) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // ตรวจสอบว่าได้ส่ง join_room แล้วหรือไม่
        const hasJoined = useChatStore.getState().isConnectedToRoom;
        if (!hasJoined) {
          console.log('WebSocket: Sending join_room after session update');
          wsRef.current.send(JSON.stringify({ type: 'join_room', chatId }));
        }
      }
    }
  }, [currentSession?.id, isInChatRoom, chatId]);

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
    console.log('connectWebSocket called', { token: !!token, currentSession: !!currentSession, wsRef: !!wsRef.current });
    
    if (
      !token ||
      (wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
         wsRef.current.readyState === WebSocket.CONNECTING))
    ) {
      console.log('connectWebSocket: Skipping connection', { 
        noToken: !token, 
        wsOpen: wsRef.current?.readyState === WebSocket.OPEN,
        wsConnecting: wsRef.current?.readyState === WebSocket.CONNECTING 
      });
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
    
    console.log('connectWebSocket: Starting connection to', config.wsUrl);
    setWsStatus('connecting');
    setIsConnectedToRoom(false); // Reset connection state
    
    let wsUrl = `${config.wsUrl}?token=${token}`;
    if (window.location.hostname === 'localhost') {
      wsUrl = `ws://localhost/ws?token=${token}`;
    }
    
    console.log('connectWebSocket: Final WebSocket URL', wsUrl);
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch (error) {
      console.error('connectWebSocket: Failed to create WebSocket', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to create WebSocket connection',
        duration: 5000
      });
      return;
    }
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      setIsConnectedToRoom(false); // จะถูก set เป็น true เมื่อ join room สำเร็จ
      
      if (isInChatRoom && chatId) {
        // ตรวจสอบว่า currentSession ถูกโหลดแล้วหรือไม่
        const session = currentSessionRef.current;
        if (session && session.id === chatId && session.messages.length > 0) {
          console.log('WebSocket: Joining room', chatId);
          ws.send(JSON.stringify({ type: 'join_room', chatId }));
        } else {
          console.log('WebSocket: Chat not loaded yet, waiting for loadChat to complete');
        }
      }
      
      console.log('[CHAT] WebSocket OPEN – pending', pendingQueueRef.current.length);
      // ส่ง pending messages ตามลำดับ
      const pendingMessages = [...pendingQueueRef.current];
      pendingQueueRef.current = [];
      
                pendingMessages.forEach((p) => {
            console.log('WebSocket: Sending pending message', p);
            try {
              // ตรวจสอบว่า message มี chatId หรือไม่
              if (p.type === 'message' && !p.chatId && chatId) {
                p.chatId = chatId;
              }
              // ตรวจสอบว่า message มี agent_id หรือไม่
              if (p.type === 'message' && !p.agent_id) {
                const currentSession = currentSessionRef.current;
                if (currentSession?.agentId) {
                  p.agent_id = currentSession.agentId;
                }
              }
              ws.send(JSON.stringify(p));
            } catch (error) {
              console.error('WebSocket: Failed to send pending message', error);
              // เก็บไว้ใน queue อีกครั้ง
              pendingQueueRef.current.push(p);
            }
          });
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
        } else if (data.type === 'error') {
          console.error('WebSocket: Server error', data.data);
          addToast({
            type: 'error',
            title: 'Server Error',
            message: data.data || 'An error occurred on the server',
            duration: 5000
          });
          // อาจจะต้อง disconnect หรือ retry ตามประเภทของ error
        } else if (data.type === 'accepted') {
          console.log('WebSocket: Message accepted by server', data.data);
          // Message ถูก server รับแล้ว
          // อาจจะเพิ่ม loading state หรือ confirmation ได้ที่นี่
        } else if (data.type === 'room_joined') {
          console.log('WebSocket: Successfully joined room', data.data.chatId);
          setIsConnectedToRoom(true);
          // อาจจะเพิ่มการแสดง toast หรือ update UI ได้ที่นี่
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
        } else if (data.type === 'tool_start') {
          console.log('WebSocket: Tool started', data.data);
          const session = currentSessionRef.current;
          const lastMessage = session?.messages[session.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            // เพิ่ม tool usage ลงใน message
            const toolInfo = {
              type: 'tool_start',
              tool_name: data.data.tool_name,
              tool_input: data.data.tool_input,
              timestamp: new Date()
            };
            updateMessage(lastMessage.id, {
              toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
            });
          }
        } else if (data.type === 'tool_result') {
          console.log('WebSocket: Tool result', data.data);
          const session = currentSessionRef.current;
          const lastMessage = session?.messages[session.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            // อัพเดท tool result
            const toolInfo = {
              type: 'tool_result',
              tool_name: data.data.tool_name,
              output: data.data.output,
              timestamp: new Date()
            };
            updateMessage(lastMessage.id, {
              toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
            });
          }
        } else if (data.type === 'tool_error') {
          console.log('WebSocket: Tool error', data.data);
          const session = currentSessionRef.current;
          const lastMessage = session?.messages[session.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            // เพิ่ม tool error
            const toolInfo = {
              type: 'tool_error',
              tool_name: data.data.tool_name,
              error: data.data.error,
              timestamp: new Date()
            };
            updateMessage(lastMessage.id, {
              toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
            });
          }
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

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      setWsStatus('disconnected');
      setIsConnectedToRoom(false); // Reset connection state
      
      if (event.code === 1000) {
        console.log('WebSocket: Normal closure');
      } else if (event.code === 1006) {
        console.log('WebSocket: Abnormal closure - attempting reconnect');
        // Abnormal closure - attempt reconnect
        setTimeout(() => {
          if (token && !isTokenExpired(token)) {
            console.log('WebSocket: Attempting reconnect after abnormal closure');
            connectWebSocket();
          }
        }, 1000);
      } else {
        console.log('WebSocket: Closure with code', event.code, event.reason);
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

  const sendMessage = useCallback((message: string, images?: Array<{ url: string; mediaType: string }>, agentId?: string) => {
    console.log('sendMessage called', { message: message.substring(0, 50) + '...', images: images?.length || 0, chatId, agentId });
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('sendMessage: WebSocket not connected, queuing message');
      pendingQueueRef.current.push({ type: 'message', text: message, images, chatId, agent_id: agentId });
      return;
    }
    
    try {
      const payload = { type: 'message', text: message, images, chatId, agent_id: agentId };
      console.log('sendMessage: Sending payload', payload);
      wsRef.current.send(JSON.stringify(payload));
    } catch (error) {
      console.error('sendMessage: Failed to send message', error);
      // เก็บไว้ใน queue เพื่อส่งใหม่เมื่อ reconnect
      pendingQueueRef.current.push({ type: 'message', text: message, images, chatId, agent_id: agentId });
      addToast({
        type: 'error',
        title: 'Send Failed',
        message: 'Failed to send message. Will retry when connection is restored.',
        duration: 3000
      });
    }
  }, [addToast, chatId]);

  return {
    wsRef,
    pendingFirstRef,
    pendingQueueRef,
    connectWebSocket,
    abortStreaming,
    isTokenExpired,
    tryRefreshToken,
    sendMessage
  };
}; 