import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from '../../config/config';
import { useChatStore, type ChatMessage } from '../stores/chatStore';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../../entities/user/store';
import { useNavigate } from 'react-router-dom';

interface UseWebSocketOptions {
  chatId?: string;
  isInChatRoom: boolean;
  isChatContext: boolean; // <--- เพิ่ม flag นี้
}

export const useWebSocket = ({ chatId, isInChatRoom, isChatContext }: UseWebSocketOptions) => {
  const wsRef = useRef<Socket | null>(null);
  const pendingQueueRef = useRef<any[]>([]);
  const pendingFirstRef = useRef<{ text: string; images?: any[]; agentId?: string } | null>(null);
  const currentSessionRef = useRef<any>(null);
  const redirectChatIdRef = useRef<string | null>(null);
  
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
  const token = useAuthStore((state: any) => state.token);
  const navigate = useNavigate();

  // Update currentSessionRef when currentSession changes
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // Token validation
  const isTokenExpired = useCallback((token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }, []);

  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const newToken = await useAuthStore.getState().refreshToken();
      return newToken !== null;
    } catch (error: any) {
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
    
    // Get current wsStatus to check if already connecting
    const currentWsStatus = useChatStore.getState().wsStatus;
    
    if (
      !token ||
      (wsRef.current && wsRef.current.connected) ||
      currentWsStatus === 'connecting'
    ) {
      console.log('connectWebSocket: Skipping connection', { 
        noToken: !token, 
        wsConnected: wsRef.current?.connected,
        wsStatus: currentWsStatus
      });
      return;
    }
    
    if (isTokenExpired(token)) {
      console.log('Token expired, attempting refresh...');
      tryRefreshToken().then((success: boolean) => {
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

      socket.on('disconnect', (reason: string) => {
        console.log('WebSocket disconnected:', reason);
        setWsStatus('disconnected');
        setIsConnectedToRoom(false);
        if (reason === 'io server disconnect') {
          socket.connect();
        } else if (reason === 'io client disconnect') {
          // Client disconnected, don't reconnect
        } else {
          // Unexpected disconnect, try to reconnect with retry limit and backoff
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
            reconnectAttemptsRef.current++;
            console.warn(`WebSocket: Attempting reconnect #${reconnectAttemptsRef.current} in ${delay}ms`);
            addToast({
              type: 'warning',
              title: 'Reconnecting...',
              message: `Connection lost. Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`,
              duration: 4000
            });
            reconnectTimeoutRef.current = setTimeout(() => {
              if (token && !isTokenExpired(token)) {
                connectWebSocket();
              }
            }, delay);
          } else {
            console.error('WebSocket: Max reconnect attempts reached. Giving up.');
            addToast({
              type: 'error',
              title: 'Connection Failed',
              message: 'Unable to reconnect to chat service. Please refresh the page or check your connection.',
              duration: 10000
            });
          }
        }
      });

      socket.on('connect_error', (error: any) => {
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

      socket.on('chunk', (data: any) => {
        const session = currentSessionRef.current;
        // ตรวจสอบ session id ก่อนอัปเดต
        if (!session || (data.chatId && session.id !== data.chatId)) return;
        const lastMessage = session.messages[session.messages.length - 1];
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

      socket.on('error', (data: any) => {
        console.error('WebSocket: Server error', data);
        addToast({
          type: 'error',
          title: 'Server Error',
          message: data.data || 'An error occurred on the server',
          duration: 5000
        });
      });

      socket.on('accepted', () => {
        // Message accepted by server (no-op)
      });

      socket.on('room_joined', (data: any) => {
        console.log('WebSocket: Successfully joined room', data.data.chatId);
        setIsConnectedToRoom(true);
      });

      socket.on('room_created', (data: any) => {
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
          // ตั้งค่าสำหรับ redirect หลัง message_sent
          redirectChatIdRef.current = data.data.chatId;
        } else {
          // ถ้าไม่มีข้อความแรก รอ redirect หลังจากนี้ (เช่นกรณีสร้างห้องเปล่า)
          redirectChatIdRef.current = data.data.chatId;
        }
      });

      socket.on('message_sent', (data: any) => {
        // ถ้าเป็นการส่งข้อความแรกหลังสร้างห้องใหม่ ให้ redirect ด้วย navigate
        if (redirectChatIdRef.current) {
          const chatIdToGo = redirectChatIdRef.current;
          redirectChatIdRef.current = null;
          // ใช้ navigate แทน window.location.href เพื่อไม่ refresh หน้า
          navigate(`/chat/${chatIdToGo}`);
        }
      });

      socket.on('tool_start', (data: any) => {
        const session = currentSessionRef.current;
        if (!session || (data.chatId && session.id !== data.chatId)) return;
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

      socket.on('tool_result', (data: any) => {
        const session = currentSessionRef.current;
        if (!session || (data.chatId && session.id !== data.chatId)) return;
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

      socket.on('tool_error', (data: any) => {
        const session = currentSessionRef.current;
        if (!session || (data.chatId && session.id !== data.chatId)) return;
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
        const session = currentSessionRef.current;
        if (!session) return;
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
  }, [token, isTokenExpired, setWsStatus, setIsConnectedToRoom, isInChatRoom, chatId, updateMessage, addMessage, setCurrentSession, setChatHistory, setIsRoomCreating, abortStreaming, addToast, tryRefreshToken, handleRoomCreated, navigate]); // ลบ currentSession ออกจาก dependency

  // --- RECONNECT STATE ---
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000; // 1s

  // --- CLEAR QUEUE ON CHAT CHANGE ---
  useEffect(() => {
    // เมื่อ chatId เปลี่ยน ให้ clear queue ที่เกี่ยวข้องกับห้องเก่า
    pendingQueueRef.current = [];
    pendingFirstRef.current = null;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [chatId]);

  // Cleanup WebSocket เฉพาะตอนออกจาก chat context หรือ unmount จริง ๆ
  useEffect(() => {
    if (!isChatContext) {
      if (wsRef.current) {
        console.log('useWebSocket: Cleaning up WebSocket connection (leave chat context)');
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    }
    return () => {
      if (wsRef.current) {
        console.log('useWebSocket: Cleaning up WebSocket connection (unmount)');
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [isChatContext]);

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