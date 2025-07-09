import { useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useAuthStore, useChatStore, useUIStore } from '../stores';
import { config } from '../../config/config';
import type { ChatMessage } from '../stores/chatStore';
import { io, Socket } from 'socket.io-client';

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
          console.log('Socket.IO: Emitting join_room after session update');
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

  // Socket.IO connection management
  const connectWebSocket = useCallback(() => {
    console.log('connectWebSocket called', { token: !!token, currentSession: !!currentSession, wsRef: !!wsRef.current });
    
    if (
      !token ||
      (wsRef.current && wsRef.current.connected)
    ) {
      console.log('connectWebSocket: Skipping connection', { 
        noToken: !token, 
        socketConnected: wsRef.current?.connected
      });
      return;
    }
    
    if (isTokenExpired(token)) {
      console.log('Token expired, attempting refresh...');
      tryRefreshToken().then((success) => {
        if (success) {
          // Close existing connection and let parent handle reconnection
          if (wsRef.current) {
            wsRef.current.disconnect();
            wsRef.current = null;
          }
        }
      });
      return;
    }
    
    console.log('connectWebSocket: Starting Socket.IO connection to', config.wsUrl);
    setWsStatus('connecting');
    setIsConnectedToRoom(false); // Reset connection state
    
    // Use Socket.IO baseURL (default /socket.io/)
    const baseUrl = config.wsUrl.replace('/ws', '').replace('/api/v1', '').replace('/api', '');
    console.log('connectWebSocket: Socket.IO base URL', baseUrl);
    
    let socket: Socket;
    try {
      socket = io(baseUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });
      wsRef.current = socket;
    } catch (error) {
      console.error('connectWebSocket: Failed to create Socket.IO connection', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to create Socket.IO connection',
        duration: 5000
      });
      return;
    }
    
    // Socket.IO event handlers
    socket.on('connect', () => {
      console.log('Socket.IO connected');
      setWsStatus('connected');
      setIsConnectedToRoom(false); // จะถูก set เป็น true เมื่อ join room สำเร็จ
      
      if (isInChatRoom && chatId) {
        // ตรวจสอบว่า currentSession ถูกโหลดแล้วหรือไม่
        const session = currentSessionRef.current;
        if (session && session.id === chatId && session.messages.length > 0) {
          console.log('Socket.IO: Joining room', chatId);
          socket.emit('join_room', { chatId });
        } else {
          console.log('Socket.IO: Chat not loaded yet, waiting for loadChat to complete');
        }
      }
      
      console.log('[CHAT] Socket.IO CONNECTED – pending', pendingQueueRef.current.length);
      // ส่ง pending messages ตามลำดับ
      const pendingMessages = [...pendingQueueRef.current];
      pendingQueueRef.current = [];
      
      pendingMessages.forEach((p) => {
        console.log('Socket.IO: Sending pending message', p);
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
          socket.emit(p.type, p);
        } catch (error) {
          console.error('Socket.IO: Failed to send pending message', error);
          // เก็บไว้ใน queue อีกครั้ง
          pendingQueueRef.current.push(p);
        }
      });
    });

    // Handle different message types
    socket.on('chunk', (data) => {
      console.log('Socket.IO: Received chunk', data);
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
    });

    socket.on('error', (data) => {
      console.error('Socket.IO: Server error', data);
      addToast({
        type: 'error',
        title: 'Server Error',
        message: data.data || 'An error occurred on the server',
        duration: 5000
      });
    });

    socket.on('accepted', (data) => {
      console.log('Socket.IO: Message accepted by server', data);
    });

    socket.on('room_joined', (data) => {
      console.log('Socket.IO: Successfully joined room', data.chatId);
      setIsConnectedToRoom(true);
    });

    socket.on('room_created', (data) => {
      console.log('Socket.IO: Room created', data.chatId);
      handleRoomCreated(data.chatId);
      
      // ส่งข้อความแรกทันทีก่อน redirect
      if (pendingFirstRef.current) {
        const { text, images: pImages, agentId: pAgentId } = pendingFirstRef.current;
        const msgPayload = {
          type: 'message',
          chatId: data.chatId,
          text,
          images: pImages,
          agent_id: pAgentId
        };
        console.log('Socket.IO: Sending first message', msgPayload);
        // ส่งข้อความทันที
        socket.emit('message', msgPayload);
        pendingFirstRef.current = null;
      }
      
      // ใช้ setTimeout เพื่อให้ข้อความถูกส่งก่อน redirect
      setTimeout(() => {
        // ใช้ window.location.href เพื่อให้ redirect ทำงานถูกต้อง
        window.location.href = `/chat/${data.chatId}`;
      }, 200);
    });

    socket.on('tool_start', (data) => {
      console.log('Socket.IO: Tool started', data);
      const session = currentSessionRef.current;
      const lastMessage = session?.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // เพิ่ม tool usage ลงใน message
        let toolInput = '';
        if (typeof data.tool_input === 'string') {
          toolInput = data.tool_input;
        } else if (typeof data.tool_input === 'object') {
          // ถ้า tool_input เป็น object ให้แปลงเป็น string
          toolInput = JSON.stringify(data.tool_input);
        }
        
        const toolInfo = {
          type: 'tool_start' as const,
          tool_name: data.tool_name as string,
          tool_input: toolInput,
          timestamp: new Date()
        };
        updateMessage(lastMessage.id, {
          toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
        });
      }
    });

    socket.on('tool_result', (data) => {
      console.log('Socket.IO: Tool result', data);
      const session = currentSessionRef.current;
      const lastMessage = session?.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // อัพเดท tool result
        const toolInfo = {
          type: 'tool_result' as const,
          tool_name: data.tool_name as string,
          output: data.output as string,
          timestamp: new Date()
        };
        updateMessage(lastMessage.id, {
          toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
        });
      }
    });

    socket.on('stream_complete', (data) => {
      console.log('Socket.IO: Stream complete', data);
      const session = currentSessionRef.current;
      const lastMessage = session?.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        updateMessage(lastMessage.id, {
          isStreaming: false,
          isComplete: true
        });
      }
    });

    socket.on('stream_error', (data) => {
      console.error('Socket.IO: Stream error', data);
      abortStreaming('Stream error');
      addToast({
        type: 'error',
        title: 'Stream Error',
        message: data.error || 'An error occurred during streaming',
        duration: 5000
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      setWsStatus('disconnected');
      setIsConnectedToRoom(false);
      
      // Abort any streaming messages
      abortStreaming('Connection lost');
      
      // Try to reconnect unless it's a manual disconnect
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        setTimeout(() => {
          console.log('Socket.IO: Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      
      // Check if it's an authentication error
      if (error.message?.includes('Authentication')) {
        console.log('Authentication error, attempting token refresh...');
        tryRefreshToken().then((success) => {
          if (success) {
            // Retry connection with new token
            setTimeout(() => {
              connectWebSocket();
            }, 1000);
          } else {
            addToast({
              type: 'error',
              title: 'Authentication Error',
              message: 'Please log in again',
              duration: 5000
            });
          }
        });
      } else {
        addToast({
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to connect to server',
          duration: 5000
        });
      }
    });

    // Handle abnormal closure
    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      
      // Check if it's a WebSocket close event (for compatibility)
      if (error && typeof error === 'object' && 'code' in error && error.code === 1006) {
        console.log('Socket.IO: Abnormal closure - attempting reconnect');
        abortStreaming('Connection lost');
        addToast({
          type: 'error',
          title: 'Connection Lost',
          message: 'Attempting to reconnect...',
          duration: 3000
        });
        
        setTimeout(() => {
          console.log('Socket.IO: Attempting reconnect after abnormal closure');
          connectWebSocket();
        }, 3000);
      }
    });

  }, [token, isInChatRoom, chatId, setWsStatus, setIsConnectedToRoom, addToast, updateMessage, addMessage, abortStreaming, handleRoomCreated, tryRefreshToken, isTokenExpired]);

  // เมื่อ disconnect ให้ cleanup
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
  }, []);

  // Send message function
  const sendMessage = useCallback((text: string, images: Array<{ url: string; mediaType: string }> = [], agentId?: string) => {
    if (!wsRef.current || !wsRef.current.connected) {
      console.log('Socket.IO: Not connected, adding to pending queue');
      pendingQueueRef.current.push({ type: 'message', text, images, agent_id: agentId });
      connectWebSocket();
      return;
    }

    const payload = {
      type: 'message',
      chatId: chatId,
      text,
      images,
      agent_id: agentId
    };

    console.log('Socket.IO: Sending message', payload);
    wsRef.current.emit('message', payload);
  }, [chatId, connectWebSocket]);

  return {
    wsRef,
    connectWebSocket,
    disconnectWebSocket,
    sendMessage
  };
}; 