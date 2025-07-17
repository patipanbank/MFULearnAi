import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, useChatStore, useUIStore } from '../stores';
import { config } from '../../config/config';
import type { ChatMessage } from '../stores/chatStore';

interface UseWebSocketOptions {
  chatId?: string;
  isInChatRoom: boolean;
}

export const useWebSocket = ({ chatId, isInChatRoom }: UseWebSocketOptions) => {
  const { token, refreshToken } = useAuthStore();
  const { 
    currentSession, 
    setCurrentSession, 
    addMessage, 
    updateMessage, 
    setChatHistory,
    setIsRoomCreating,
    setWsStatus,
    setIsConnectedToRoom
  } = useChatStore();
  const { addToast } = useUIStore();
  
  const wsRef = useRef<Socket | null>(null);
  const pendingQueueRef = useRef<any[]>([]);
  const pendingFirstRef = useRef<{ text: string; images: any[]; agentId: string } | null>(null);
  const currentSessionRef = useRef(currentSession);

  // Update currentSessionRef when currentSession changes
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

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
        const currentChatHistory = useChatStore.getState().chatHistory;
        setChatHistory([
          { ...session, id: roomId },
          ...currentChatHistory.filter((chat: any) => chat.id !== session.id)
        ]);
      }
    }
    setIsRoomCreating(false);
  }, [setCurrentSession, setChatHistory, setIsRoomCreating]);

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
      wsUrl = `http://localhost:3000`;
    } else if (window.location.hostname === 'mfulearnai.mfu.ac.th') {
      // ใช้ https:// สำหรับ production
      wsUrl = `https://mfulearnai.mfu.ac.th`;
    }
    
    console.log('connectWebSocket: Final Socket.IO URL', wsUrl);
    
    let socket: Socket;
    try {
      socket = io(wsUrl, {
        path: '/socket.io',  // เปลี่ยนจาก '/wsเป็น '/socket.io'
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,  // เพิ่ม timeout
        forceNew: true
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
      
      console.log('[CHAT] Socket.IO OPEN – pending', pendingQueueRef.current.length);
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
    
    socket.on('connected', (data) => {
      console.log('Socket.IO: Received connected event', data);
    });
    
    socket.on('chunk', (data) => {
      console.log('Socket.IO: Received chunk', data);
      const session = currentSessionRef.current;
      const lastMessage = session?.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        updateMessage(lastMessage.id, {
          content: lastMessage.content + data
        });
      } else {
        const assistantMsg: ChatMessage = {
          id: Date.now().toString() + '_assistant',
          role: 'assistant',
          content: data,
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
        message: data || 'An error occurred on the server',
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
      console.log('Socket.IO: Room created full data:', data);
      console.log('Socket.IO: pendingFirstRef.current:', pendingFirstRef.current);
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
        wsRef.current?.emit('message', msgPayload);
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
    
    socket.on('tool_error', (data) => {
      console.log('Socket.IO: Tool error', data);
      const session = currentSessionRef.current;
      const lastMessage = session?.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // เพิ่ม tool error
        const toolInfo = {
          type: 'tool_error' as const,
          tool_name: data.tool_name as string,
          error: data.error as string,
          timestamp: new Date()
        };
        updateMessage(lastMessage.id, {
          toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
        });
      }
    });
    
    socket.on('end', () => {
      console.log('Socket.IO: Message ended');
      const session = currentSessionRef.current;
      const lastMessage = session?.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        updateMessage(lastMessage.id, {
          isComplete: true,
          isStreaming: false
        });
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected', reason);
      setWsStatus('disconnected');
      setIsConnectedToRoom(false); // Reset connection state
      
      if (reason === 'io server disconnect') {
        console.log('Socket.IO: Server disconnected');
      } else if (reason === 'io client disconnect') {
        console.log('Socket.IO: Client disconnected');
      } else {
        console.log('Socket.IO: Abnormal disconnect - attempting reconnect');
        // Abnormal disconnect - attempt reconnect
        setTimeout(() => {
          if (token && !isTokenExpired(token)) {
            console.log('Socket.IO: Attempting reconnect after abnormal disconnect');
            connectWebSocket();
          }
        }, 1000);
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to connect to chat service. Retrying...',
        duration: 5000
      });
    });
  }, [token, currentSession, isTokenExpired, setWsStatus, setIsConnectedToRoom, isInChatRoom, chatId, updateMessage, addMessage, setCurrentSession, setChatHistory, setIsRoomCreating, addToast, tryRefreshToken, handleRoomCreated]);

  // Cleanup Socket.IO on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  const sendMessage = useCallback((message: string, images?: Array<{ url: string; mediaType: string }>, agentId?: string) => {
    console.log('sendMessage called', { message: message.substring(0, 50) + '...', images: images?.length || 0, chatId, agentId });
    
    // ตรวจสอบว่ามี chatId หรือไม่
    if (!chatId) {
      console.error('sendMessage: No chatId provided');
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Chat ID is required to send message',
        duration: 3000
      });
      return;
    }
    
    if (!wsRef.current || !wsRef.current.connected) {
      console.log('sendMessage: Socket.IO not connected, queuing message');
      pendingQueueRef.current.push({ type: 'message', text: message, images, chatId, agent_id: agentId });
      return;
    }
    
    try {
      const payload = { type: 'message', text: message, images, chatId, agent_id: agentId };
      console.log('sendMessage: Sending payload', payload);
      wsRef.current.emit('message', payload);
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

  const createRoom = useCallback((agentId: string) => {
    console.log('createRoom called', { agentId });
    
    if (!wsRef.current || !wsRef.current.connected) {
      console.log('createRoom: Socket.IO not connected, queuing create room request');
      pendingQueueRef.current.push({ type: 'create_room', agent_id: agentId });
      return;
    }
    
    try {
      const payload = { type: 'create_room', agent_id: agentId };
      console.log('createRoom: Sending payload', payload);
      wsRef.current.emit('create_room', payload);
    } catch (error) {
      console.error('createRoom: Failed to send create room request', error);
      pendingQueueRef.current.push({ type: 'create_room', agent_id: agentId });
      addToast({
        type: 'error',
        title: 'Create Room Failed',
        message: 'Failed to create chat room. Will retry when connection is restored.',
        duration: 3000
      });
    }
  }, [addToast]);

  return {
    wsRef,
    pendingFirstRef,
    pendingQueueRef,
    connectWebSocket,
    abortStreaming,
    isTokenExpired,
    tryRefreshToken,
    sendMessage,
    createRoom
  };
}; 