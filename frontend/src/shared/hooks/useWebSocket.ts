import { useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useAuthStore, useChatStore, useUIStore } from '../stores';
import { config } from '../../config/config';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  chatId?: string;
  isInChatRoom: boolean;
}

export const useWebSocket = ({ chatId, isInChatRoom }: UseWebSocketOptions) => {
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  
  const currentSession = useChatStore((state) => state.currentSession);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setWsStatus = useChatStore((state) => state.setWsStatus);
  const setIsConnectedToRoom = useChatStore((state) => state.setIsConnectedToRoom);
  const chatHistory = useChatStore((state) => state.chatHistory);
  
  const addToast = useUIStore((state) => state.addToast);

  const wsRef = useRef<Socket | null>(null);
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
      if (wsRef.current && wsRef.current.connected) {
        // ตรวจสอบว่าได้ส่ง join_room แล้วหรือไม่
        const hasJoined = useChatStore.getState().isConnectedToRoom;
        if (!hasJoined) {
          console.log('WebSocket: Sending join_room after session update');
          wsRef.current.emit('join_room', { chatId });
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
    if (!token || (wsRef.current && wsRef.current.connected)) {
      console.log('connectWebSocket: Skipping connection', {
        noToken: !token,
        wsConnected: wsRef.current?.connected,
      });
      return;
    }
    if (isTokenExpired(token)) {
      console.log('Token expired, attempting refresh...');
      tryRefreshToken().then((success) => {
        if (success && wsRef.current) {
          wsRef.current.disconnect();
          wsRef.current = null;
        }
      });
      return;
    }
    let wsUrl = config.wsUrl;
    if (window.location.hostname === 'localhost') {
      wsUrl = 'ws://localhost/ws';
    }
    console.log('connectWebSocket: Final Socket.IO URL', wsUrl);
    const socket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token },
      path: '/ws',
      withCredentials: true,
    });
    wsRef.current = socket;
    socket.on('connect', () => {
      console.log('Socket.io connected');
      setWsStatus('connected');
      setIsConnectedToRoom(false);
      if (isInChatRoom && chatId) {
        const session = currentSessionRef.current;
        if (session && session.id === chatId && session.messages.length > 0) {
          console.log('Socket.io: Joining room', chatId);
          socket.emit('join_room', { chatId });
        } else {
          console.log('Socket.io: Chat not loaded yet, waiting for loadChat to complete');
        }
      }
      // ส่ง pending messages ตามลำดับ
      const pendingMessages = [...pendingQueueRef.current];
      pendingQueueRef.current = [];
      pendingMessages.forEach((p) => {
        if (p.type === 'message' && !p.chatId && chatId) {
          p.chatId = chatId;
        }
        if (p.type === 'message' && !p.agent_id) {
          const currentSession = currentSessionRef.current;
          if (currentSession?.agentId) {
            p.agent_id = currentSession.agentId;
          }
        }
        socket.emit(p.type, p);
      });
    });
    socket.on('disconnect', () => {
      setWsStatus('disconnected');
      setIsConnectedToRoom(false);
      console.log('Socket.io disconnected');
    });
    socket.onAny((event, data) => {
      try {
        console.log('Socket.io: Received event', event, data);
        // handle events เช่น connected, room_created, accepted, chunk, end, error, etc.
        // ... (คง logic เดิมที่ ws.onmessage)
      } catch (err) {
        console.error('Socket.io: Failed to handle event', event, err);
      }
    });
    socket.on('connect_error', (err) => {
      setWsStatus('error');
      setIsConnectedToRoom(false);
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to create Socket.IO connection',
        duration: 5000
      });
      console.error('Socket.io connect_error', err);
    });
  }, [token, currentSession, isTokenExpired, tryRefreshToken, setWsStatus, setIsConnectedToRoom, isInChatRoom, chatId, addToast]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  const sendMessage = useCallback((message: string, images?: Array<{ url: string; mediaType: string }>, agentId?: string) => {
    console.log('sendMessage called', { message: message.substring(0, 50) + '...', images: images?.length || 0, chatId, agentId });
    if (!wsRef.current || !wsRef.current.connected) {
      console.log('sendMessage: Socket.io not connected, queuing message');
      pendingQueueRef.current.push({ type: 'message', text: message, images, chatId, agent_id: agentId });
      return;
    }
    try {
      const payload = { type: 'message', text: message, images, chatId, agent_id: agentId };
      console.log('sendMessage: Sending payload', payload);
      wsRef.current.emit('message', payload);
    } catch (error) {
      console.error('sendMessage: Failed to send message', error);
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