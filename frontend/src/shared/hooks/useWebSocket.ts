import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from '../../config/config';
import { useChatStore, type ChatMessage } from '../stores/chatStore';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../../entities/user/store';

interface UseWebSocketOptions {
  chatId?: string;
  isInChatRoom: boolean;
}

export const useWebSocket = ({ chatId, isInChatRoom }: UseWebSocketOptions) => {
  const wsRef = useRef<Socket | null>(null);
  const pendingQueueRef = useRef<any[]>([]);
  const pendingFirstRef = useRef<{ text: string; images?: any[]; agentId?: string } | null>(null);
  const currentSessionRef = useRef<any>(null);
  
  const {
    currentSession,
    setCurrentSession,
    addMessage,
    updateMessage,
    setChatHistory,
    setIsRoomCreating,
    setWsStatus,
    setIsConnectedToRoom,
  } = useChatStore();
  
  const { addToast } = useUIStore();
  const token = useAuthStore((state) => state.token);

  // Token validation
  const isTokenExpired = useCallback((token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }, []);

  const tryRefreshToken = useCallback(async () => {
    try {
      const newToken = await useAuthStore.getState().refreshToken();
      return newToken !== null;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }, []);

  const handleRoomCreated = useCallback((chatId: string) => {
    setIsRoomCreating(false);
    setCurrentSession({ 
      id: chatId, 
      name: 'New Chat',
      messages: [], 
      agentId: '',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }, [setIsRoomCreating, setCurrentSession]);

  const abortStreaming = useCallback((reason: string) => {
    const session = currentSessionRef.current;
    if (session) {
      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        updateMessage(lastMessage.id, {
          isStreaming: false,
          isComplete: true,
          content: lastMessage.content + `\n\n[Connection lost: ${reason}]`
        });
      }
    }
  }, [updateMessage]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    console.log('connectWebSocket called', { token: !!token, currentSession: !!currentSession, wsRef: !!wsRef.current });
    
    if (
      !token ||
      (wsRef.current && wsRef.current.connected)
    ) {
      console.log('connectWebSocket: Skipping connection', { 
        noToken: !token, 
        wsConnected: wsRef.current?.connected
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
    
    console.log('connectWebSocket: Starting connection to', config.wsUrl);
    setWsStatus('connecting');
    setIsConnectedToRoom(false); // Reset connection state
    
    let wsUrl = config.wsUrl;
    if (window.location.hostname === 'localhost') {
      wsUrl = 'ws://localhost/ws';
    }
    
    console.log('connectWebSocket: Final WebSocket URL', wsUrl);
    
          try {
        console.log('Creating Socket.IO connection with token:', token ? token.substring(0, 50) + '...' : 'None');
        const socket = io(wsUrl, {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: true,
          timeout: 20000,
          forceNew: true
        });
      
      wsRef.current = socket;
      
      socket.on('connect', () => {
        console.log('WebSocket connected');
        setWsStatus('connected');
        setIsConnectedToRoom(false); // จะถูก set เป็น true เมื่อ join room สำเร็จ
        
        if (isInChatRoom && chatId) {
          // ตรวจสอบว่า currentSession ถูกโหลดแล้วหรือไม่
          const session = currentSessionRef.current;
          if (session && session.id === chatId && session.messages.length > 0) {
            console.log('WebSocket: Joining room', chatId);
            socket.emit('join_room', { chatId });
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
            socket.emit('send_message', p);
          } catch (error) {
            console.error('WebSocket: Failed to send pending message', error);
            // เก็บไว้ใน queue อีกครั้ง
            pendingQueueRef.current.push(p);
          }
        });
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setWsStatus('disconnected');
        setIsConnectedToRoom(false);
        
        if (reason === 'io server disconnect') {
          // Server disconnected us, try to reconnect
          socket.connect();
        } else if (reason === 'io client disconnect') {
          // Client disconnected, don't reconnect
        } else {
          // Unexpected disconnect, try to reconnect
          setTimeout(() => {
            if (token && !isTokenExpired(token)) {
              console.log('WebSocket: Attempting reconnect after unexpected disconnect');
              connectWebSocket();
            }
          }, 1000);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setWsStatus('error');
        setIsConnectedToRoom(false);
        abortStreaming('CONNECTION LOST');
        addToast({
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to connect to chat service. Retrying...',
          duration: 5000
        });
      });

      socket.on('chunk', (data) => {
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
        console.error('WebSocket: Server error', data);
        addToast({
          type: 'error',
          title: 'Server Error',
          message: data.data || 'An error occurred on the server',
          duration: 5000
        });
      });

      socket.on('accepted', (data) => {
        console.log('WebSocket: Message accepted by server', data);
      });

      socket.on('room_joined', (data) => {
        console.log('WebSocket: Successfully joined room', data.data.chatId);
        setIsConnectedToRoom(true);
      });

      socket.on('room_created', (data) => {
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
          wsRef.current?.emit('send_message', msgPayload);
          pendingFirstRef.current = null;
        }
        
        // ใช้ setTimeout เพื่อให้ข้อความถูกส่งก่อน redirect
        setTimeout(() => {
          // ใช้ window.location.href เพื่อให้ redirect ทำงานถูกต้อง
          window.location.href = `/chat/${data.data.chatId}`;
        }, 200);
      });

      socket.on('tool_start', (data) => {
        console.log('WebSocket: Tool started', data);
        const session = currentSessionRef.current;
        const lastMessage = session?.messages[session.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          // เพิ่ม tool usage ลงใน message
          let toolInput = '';
          if (typeof data.data.tool_input === 'string') {
            toolInput = data.data.tool_input;
          } else if (typeof data.data.tool_input === 'object') {
            // ถ้า tool_input เป็น object ให้แปลงเป็น string
            toolInput = JSON.stringify(data.data.tool_input);
          }
          
          const toolInfo = {
            type: 'tool_start' as const,
            tool_name: data.data.tool_name as string,
            tool_input: toolInput,
            timestamp: new Date()
          };
          updateMessage(lastMessage.id, {
            toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
          });
        }
      });

      socket.on('tool_result', (data) => {
        console.log('WebSocket: Tool result', data);
        const session = currentSessionRef.current;
        const lastMessage = session?.messages[session.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          // อัพเดท tool result
          const toolInfo = {
            type: 'tool_result' as const,
            tool_name: data.data.tool_name as string,
            output: data.data.output as string,
            timestamp: new Date()
          };
          updateMessage(lastMessage.id, {
            toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
          });
        }
      });

      socket.on('tool_error', (data) => {
        console.log('WebSocket: Tool error', data);
        const session = currentSessionRef.current;
        const lastMessage = session?.messages[session.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          // เพิ่ม tool error
          const toolInfo = {
            type: 'tool_error' as const,
            tool_name: data.data.tool_name as string,
            error: data.data.error as string,
            timestamp: new Date()
          };
          updateMessage(lastMessage.id, {
            toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
          });
        }
      });

      socket.on('end', () => {
        console.log('WebSocket: Message ended');
        const session = currentSessionRef.current;
        const lastMessage = session?.messages[session.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          updateMessage(lastMessage.id, {
            isComplete: true,
            isStreaming: false
          });
        }
      });

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
  }, [token, currentSession, isTokenExpired, setWsStatus, setIsConnectedToRoom, isInChatRoom, chatId, updateMessage, addMessage, setCurrentSession, setChatHistory, setIsRoomCreating, abortStreaming, addToast, tryRefreshToken, handleRoomCreated]);

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
      console.log('sendMessage: WebSocket not connected, queuing message');
      pendingQueueRef.current.push({ type: 'message', text: message, images, chatId, agent_id: agentId });
      return;
    }
    
    try {
      const payload = { type: 'message', text: message, images, chatId, agent_id: agentId };
      console.log('sendMessage: Sending payload', payload);
      wsRef.current.emit('send_message', payload);
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