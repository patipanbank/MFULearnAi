import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useChatStore, useUIStore } from '../stores';
import type { ChatMessage } from '../stores/chatStore';
import { WebSocketManager, WebSocketMessage } from '../lib/WebSocketManager';

interface UseWebSocketOptions {
  chatId?: string;
  isInChatRoom: boolean;
}

export const useWebSocket = ({ chatId, isInChatRoom }: UseWebSocketOptions) => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);

  const currentSession = useChatStore((state) => state.currentSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setWsStatus = useChatStore((state) => state.setWsStatus);
  const setIsConnectedToRoom = useChatStore((state) => state.setIsConnectedToRoom);
  const setIsTyping = useChatStore((state) => state.setIsTyping);
  const setIsRoomCreating = useChatStore((state) => state.setIsRoomCreating);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);
  const setChatHistory = useChatStore((state) => state.setChatHistory);
  const chatHistory = useChatStore((state) => state.chatHistory);

  const addToast = useUIStore((state) => state.addToast);
  const [isConnected, setIsConnected] = useState(false);

  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const pendingFirstRef = useRef<{
    text: string;
    images: Array<{ url: string; mediaType: string }>;
    agentId?: string;
  } | null>(null);

  // Auto-join room when session is loaded
  useEffect(() => {
    if (currentSession && isInChatRoom && chatId && currentSession.id === chatId &&
        currentSession.messages.length > 0 && wsManagerRef.current?.isConnected) {
      const hasJoined = useChatStore.getState().isConnectedToRoom;
      if (!hasJoined) {
        console.log('WebSocket: Sending join_room after session update');
        wsManagerRef.current.send({ type: 'join_room', chatId });
      }
    }
  }, [currentSession?.id, isInChatRoom, chatId, isConnected]);

  // Helper functions
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < currentTime;
    } catch {
      return true;
    }
  }, []);

  const abortStreaming = useCallback((reason: string) => {
    if (!currentSession) return;
    const lastMsg = currentSession.messages[currentSession.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
      updateMessage(lastMsg.id, {
        content: lastMsg.content + `\n[${reason}]`,
        isStreaming: false,
        isComplete: true,
      });
    }
  }, [currentSession, updateMessage]);

  const handleRoomCreated = useCallback((roomId: string) => {
    console.log('Creating new chat room:', roomId);

    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        id: roomId,
      });

      if (roomId.length === 24) {
        setChatHistory([
          { ...currentSession, id: roomId },
          ...chatHistory.filter((chat: any) => chat.id !== currentSession.id)
        ]);
      }
    }
    setIsRoomCreating(false);
  }, [currentSession, setCurrentSession, setChatHistory, chatHistory, setIsRoomCreating]);

  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Attempting to refresh token...');
      const newToken = await refreshToken();
      if (newToken) {
        console.log('Token refreshed successfully');
        if (wsManagerRef.current) {
          wsManagerRef.current.updateToken(newToken);
        }
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }, [refreshToken]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('WebSocket: Received message', message);

    if (message.type === 'upload-progress') {
      window.dispatchEvent(new CustomEvent('websocket-message', {
        detail: JSON.stringify(message)
      }));
      return;
    }

    switch (message.type) {
      case 'error':
        console.error('WebSocket: Server error', message.data);
        let errorMessage = 'An error occurred on the server';
        if (typeof message.data === 'string' && message.data.trim() !== '') {
          errorMessage = message.data;
        } else if (typeof message.data === 'object' && message.data?.message) {
          errorMessage = message.data.message;
        } else if (typeof message.data === 'object') {
          errorMessage = 'Server encountered an error while processing your request';
        }
        addToast({
          type: 'error',
          title: 'Server Error',
          message: errorMessage,
          duration: 5000
        });
        setIsTyping(false);
        break;

      case 'accepted':
        console.log('WebSocket: Message accepted by server', message.data);
        break;

      case 'room_joined':
        console.log('WebSocket: Successfully joined room', message.data.chatId);
        setIsConnectedToRoom(true);
        break;

      case 'room_created':
        console.log('WebSocket: Room created', message.data.chatId);
        handleRoomCreated(message.data.chatId);

        if (pendingFirstRef.current) {
          const { text, images: pImages, agentId: pAgentId } = pendingFirstRef.current;
          const msgPayload = {
            type: 'message',
            chatId: message.data.chatId,
            text,
            images: pImages,
            agent_id: pAgentId
          };
          console.log('WebSocket: Sending first message', msgPayload);
          wsManagerRef.current?.send(msgPayload);
          pendingFirstRef.current = null;
        }

        setTimeout(() => {
          navigate(`/chat/${message.data.chatId}`, { replace: true });
        }, 200);
        break;

      case 'message_added':
        console.log('WebSocket: Message added', message.data);
        const newMessage: ChatMessage = {
          id: message.data.message.id,
          role: message.data.message.role,
          content: message.data.message.content,
          timestamp: new Date(message.data.message.timestamp),
          images: message.data.message.images,
          isStreaming: message.data.message.isStreaming || false,
          isComplete: message.data.message.isComplete || false
        };
        addMessage(newMessage);
        if (newMessage.role === 'assistant') {
          setIsTyping(false);
        }
        break;

      case 'message_updated':
        console.log('WebSocket: Message updated', message.data);
        updateMessage(message.data.messageId, {
          content: message.data.content,
          isStreaming: message.data.isStreaming || false
        });
        break;

      case 'message_completed':
        console.log('WebSocket: Message completed', message.data);
        updateMessage(message.data.messageId, {
          content: message.data.content,
          isStreaming: false,
          isComplete: true
        });
        break;

      case 'message_error':
        console.log('WebSocket: Message error', message.data);
        updateMessage(message.data.messageId, {
          content: `[Error: ${message.data.error}]`,
          isStreaming: false,
          isComplete: true
        });
        break;

      case 'tool_start':
        console.log('WebSocket: Tool started', message.data);
        const lastMessage = currentSession?.messages[currentSession.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          let toolInput = '';
          if (typeof message.data.tool_input === 'string') {
            toolInput = message.data.tool_input;
          } else if (typeof message.data.tool_input === 'object') {
            toolInput = JSON.stringify(message.data.tool_input);
          }

          const toolInfo = {
            type: 'tool_start' as const,
            tool_name: message.data.tool_name as string,
            tool_input: toolInput,
            timestamp: new Date()
          };
          updateMessage(lastMessage.id, {
            toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
          });
        }
        break;

      case 'tool_result':
      case 'tool_error':
        console.log(`WebSocket: Tool ${message.type}`, message.data);
        const currentLastMessage = currentSession?.messages[currentSession.messages.length - 1];
        if (currentLastMessage && currentLastMessage.role === 'assistant') {
          const toolInfo = {
            type: message.type as 'tool_result' | 'tool_error',
            tool_name: message.data.tool_name as string,
            output: message.data.output as string,
            error: message.data.error as string,
            timestamp: new Date()
          };
          updateMessage(currentLastMessage.id, {
            toolUsage: [...(currentLastMessage.toolUsage || []), toolInfo]
          });
        }
        break;

      case 'image_processing_error':
        console.log('WebSocket: Image processing error', message.data);
        addToast({
          type: 'warning',
          title: 'Image Processing',
          message: message.data.message || 'Some images could not be processed',
          duration: 4000
        });
        break;

      case 'quota_exceeded':
        console.log('WebSocket: Quota exceeded', message.data);
        addToast({
          type: 'error',
          title: 'Usage Limit Exceeded',
          message: message.data.reason || 'You have exceeded your usage quota',
          duration: 5000
        });
        break;

      default:
        console.debug('WS unhandled event', message);
    }
  }, [currentSession, addMessage, updateMessage, setIsTyping, setIsConnectedToRoom,
      handleRoomCreated, addToast, navigate]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!token || isTokenExpired(token)) {
      if (isTokenExpired(token)) {
        console.log('Token expired, attempting refresh...');
        tryRefreshToken();
      }
      return;
    }

    if (wsManagerRef.current?.isConnected) {
      return; // Already connected
    }

    // Initialize WebSocket manager
    wsManagerRef.current = new WebSocketManager({
      token,
      onOpen: () => {
        console.log('✅ WebSocket connected');
        setWsStatus('connected');
        setIsConnected(true);
        setIsConnectedToRoom(false);

        if (isInChatRoom && chatId && currentSession?.id === chatId && currentSession.messages.length > 0) {
          console.log('WebSocket: Joining room', chatId);
          wsManagerRef.current?.send({ type: 'join_room', chatId });
        }
      },
      onMessage: handleWebSocketMessage,
      onError: (error) => {
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
      },
      onClose: (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        setWsStatus('disconnected');
        setIsConnected(false);
        setIsConnectedToRoom(false);
      },
      onReconnect: () => {
        console.log('WebSocket: Attempting reconnect');
        setWsStatus('connecting');
      }
    });

    wsManagerRef.current.connect();
  }, [token, isTokenExpired, tryRefreshToken, isInChatRoom, chatId,
      currentSession, handleWebSocketMessage, abortStreaming, addToast,
      setWsStatus, setIsConnectedToRoom, setIsTyping]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      wsManagerRef.current?.disconnect();
      wsManagerRef.current = null;
    };
  }, []);

  // Initialize WebSocket when component mounts or token changes
  useEffect(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  const sendMessage = useCallback((message: string, images?: Array<{ url: string; mediaType: string }>, agentId?: string) => {
    console.log('sendMessage called', { message: message.substring(0, 50) + '...', images: images?.length || 0, chatId, agentId });

    const payload = {
      type: 'message',
      text: message,
      images,
      chatId,
      agent_id: agentId || currentSession?.agentId
    };

    const sent = wsManagerRef.current?.send(payload);
    if (!sent) {
      console.log('sendMessage: Message queued for later delivery');
      // WebSocketManager will handle queuing automatically
    }
  }, [chatId, currentSession?.agentId]);

  return {
    connectWebSocket,
    sendMessage,
    isConnected,
    pendingFirstRef,
    wsManager: wsManagerRef.current
  };
}; 