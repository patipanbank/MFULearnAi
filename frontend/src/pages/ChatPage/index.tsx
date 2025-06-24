import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import { config } from '../../config/config';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import dindinAvatar from '../../assets/dindin.png';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../shared/lib/utils';

// Message animation variants
const messageVariants = {
  hidden: { 
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: { 
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 40
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

// Typing indicator animation
const TypingIndicator = () => (
  <div className="flex items-center space-x-2 p-4 bg-primary/5 rounded-lg">
    <div className="flex space-x-1">
      <motion.div
        className="w-2 h-2 bg-primary/40 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
      />
      <motion.div
        className="w-2 h-2 bg-primary/40 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.5, delay: 0.2, repeat: Infinity, repeatType: "reverse" }}
      />
      <motion.div
        className="w-2 h-2 bg-primary/40 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.5, delay: 0.4, repeat: Infinity, repeatType: "reverse" }}
      />
    </div>
    <span className="text-sm text-primary/60">AI กำลังพิมพ์...</span>
  </div>
);

// Message component
const ChatMessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const { user } = useAuthStore();
  
  const getInitials = () => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };
  
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "flex w-full mb-6",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 mr-4">
          <img
            src={dindinAvatar}
            alt="AI Avatar"
            className="w-10 h-10 rounded-full shadow-lg border-2 border-primary/20"
          />
        </div>
      )}
      
      <div className={cn(
        "flex flex-col max-w-[80%] space-y-1",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "px-4 py-3 rounded-2xl break-words",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          message.isStreaming && "animate-pulse"
        )}>
          <div className="prose prose-sm max-w-none">
            {message.content}
          </div>
          {message.images && message.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img.url}
                  alt="Attached"
                  className="max-w-[200px] rounded-lg border border-primary/20 hover:scale-105 transition-transform cursor-pointer"
                />
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(message.timestamp), 'HH:mm', { locale: th })}
        </span>
      </div>

      {isUser && (
        <div className="flex-shrink-0 ml-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {getInitials()}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const ChatPage: React.FC = () => {
  const { user, token, refreshToken } = useAuthStore();
  const { 
    currentSession, 
    addMessage, 
    updateMessage,
    createNewChat,
    wsStatus,
    setWsStatus,
    isTyping,
    setIsTyping,
    setCurrentSession,
    chatHistory,
    setChatHistory,
    loadChat,
    isLoading
  } = useChatStore();
  
  const { 
    selectedAgent,
    fetchAgents
  } = useAgentStore();
  
  const { setLoading, addToast } = useUIStore();
  
  // Navigation
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  
  // Local state
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Array<{ url: string; mediaType: string }>>([]);
  const [isConnectedToRoom, setIsConnectedToRoom] = useState(false);
  const [isRoomCreating, setIsRoomCreating] = useState(false);
  
  // Use a ref for the first pending message so the latest value is always
  // visible inside WebSocket callbacks (avoids stale closure issues).
  type PendingFirst = {
    text: string;
    images: Array<{ url: string; mediaType: string }>;
    agentId?: string;
  } | null;

  const pendingFirstRef = useRef<PendingFirst>(null);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Keep a ref to always access latest session inside websocket callbacks
  const currentSessionRef = useRef<typeof currentSession>(null); // NEW REF
  // Keep latest chatHistory to avoid stale closure
  const chatHistoryRef = useRef<typeof chatHistory>(chatHistory);
  
  // Queue of pending payloads when websocket is not yet connected
  type PendingPayload = Record<string, any>; // generic event payload

  const pendingQueueRef = useRef<PendingPayload[]>([]);
  
  // Determine if we're in a specific chat room
  const isInChatRoom = Boolean(chatId);
  const hasMessages = (currentSession?.messages.length || 0) > 0;
  
  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true, 'Loading agents...');
      try {
        await fetchAgents();
      } catch (error) {
        console.error('Failed to initialize data:', error);
        addToast({
          type: 'error',
          title: 'Initialization Error',
          message: 'Failed to load agents'
        });
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, [fetchAgents, setLoading, addToast]);
  
  // Cleanup placeholder chats (id not ObjectId) once on mount
  useEffect(() => {
    setChatHistory(chatHistory.filter((c) => c.id && c.id.length === 24));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // เมื่อ URL มี chatId ให้โหลดประวัติหนึ่งครั้งและเชื่อม WS
  useEffect(() => {
    if (!isInChatRoom || !chatId) return;

    if (currentSession && currentSession.id === chatId) {
      if (!isConnectedToRoom) connectWebSocket();
      return; // already loaded
    }

    (async () => {
      const ok = await loadChat(chatId);
      if (ok) {
        connectWebSocket();
      } else {
        navigate('/chat');
        createNewChat();
      }
    })();
  }, [chatId, isInChatRoom]);

  // กรณี /chat (ไม่มี id)
  useEffect(() => {
    if (isInChatRoom) return; // handled above
    
    // If we are on /chat but the current session is a real, saved chat,
    // we must create a new one to prevent sending messages to the old chat.
    if (!currentSession || !currentSession.id.startsWith('chat_')) {
      createNewChat();
    }
  }, [isInChatRoom, currentSession]);
  
  // Update session ID when chat room changes
  useEffect(() => {
    if (isInChatRoom && chatId && currentSession && currentSession.id !== chatId) {
      // Update current session ID to match the chat room
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          id: chatId,
        });
      }
    }
  }, [chatId, isInChatRoom, currentSession]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);
  
  // Update ref whenever state changes
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);
  
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);
  
  // Reset input local state when switching to a different session (e.g., New Chat)
  useEffect(() => {
    // Whenever session ID changes, clear draft message & images
    setMessage('');
    setImages([]);
    // Also reset typing indicator and pending queue
    setIsTyping(false);
    pendingQueueRef.current = [];
  }, [currentSession?.id]);
  
  // Helper function to check if token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < currentTime;
    } catch {
      return true; // Consider invalid tokens as expired
    }
  };

  // Helper function to try token refresh and reconnect
  const tryRefreshAndReconnect = async (): Promise<boolean> => {
    try {
      console.log('Attempting to refresh token...');
      const newToken = await refreshToken();
      if (newToken) {
        console.log('Token refreshed successfully, reconnecting WebSocket...');
        // Small delay to ensure token is updated in store
        setTimeout(() => {
          connectWebSocket();
        }, 500);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  };
  
  // Helper to mark current streaming assistant as aborted
  const abortStreaming = (reason: string) => {
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
    setIsTyping(false);
  };
  
  // WebSocket connection management
  const connectWebSocket = () => {
    if (
      !token ||
      !currentSession ||
      (wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
         wsRef.current.readyState === WebSocket.CONNECTING))
    ) {
      return;
    }
    
    // Check if token is expired before connecting
    if (isTokenExpired(token)) {
      console.log('Token expired, attempting refresh...');
      tryRefreshAndReconnect();
      return;
    }
    
    setWsStatus('connecting');
    
    // Use the new /ws endpoint
    let wsUrl = `${config.wsUrl}?token=${token}`;
    
    // For local development, use localhost WebSocket
    if (window.location.hostname === 'localhost') {
      wsUrl = `ws://localhost/ws?token=${token}`;
    }
    
    const ws = new WebSocket(wsUrl);
    // Assign immediately so subsequent calls recognise a connection attempt
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      setIsConnectedToRoom(true);
      
      // If joining an existing room, send a join event immediately
      // This helps the backend register the socket to the room without waiting for a message.
      if (isInChatRoom && chatId) {
        ws.send(JSON.stringify({ type: 'join_room', chatId }));
      }
      
      // Show connection success toast
      addToast({
        type: 'success',
        title: 'Connected',
        message: 'Chat service connected successfully',
        duration: 3000
      });
      
      // ส่งคิวข้อความที่ค้างทั้งหมด (สร้างใหม่ในรูปแบบ event)
      console.log('[CHAT] WebSocket OPEN – pending', pendingQueueRef.current.length);
      pendingQueueRef.current.forEach((p) => {
        ws.send(JSON.stringify(p));
      });
      pendingQueueRef.current = [];
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          // Handle streaming response – always read latest state from ref
          const session = currentSessionRef.current;
          const lastMessage = session?.messages[session.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            updateMessage(lastMessage.id, {
              content: lastMessage.content + data.data
            });
          } else {
            // สร้าง assistant message หากยังไม่มี
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
          handleRoomCreated(data.data.chatId);
          if (pendingFirstRef.current) {
            const { text, images: pImages, agentId: pAgentId } = pendingFirstRef.current;
            const msgPayload = {
              type: 'message',
              chatId: data.data.chatId,
              text,
              images: pImages,
              agent_id: pAgentId
            };
            wsRef.current?.send(JSON.stringify(msgPayload));
            pendingFirstRef.current = null;
          }
        } else if (data.type === 'end') {
          // Mark message as complete
          const session = currentSessionRef.current;
          const lastMessage = session?.messages[session.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            updateMessage(lastMessage.id, {
              isComplete: true,
              isStreaming: false
            });
          }
          setIsTyping(false);
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.data);
          addToast({
            type: 'error',
            title: 'Chat Error',
            message: data.data
          });
          abortStreaming('ERROR');
        } else {
          // Fallback: log any unexpected messages for easier debugging
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
      // Clear ref so new connection can be established
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      setWsStatus('disconnected');
      setIsConnectedToRoom(false);
      
      // Handle different close codes
      if (event.code === 1000) {
        // Normal closure - no error needed
        console.log('WebSocket closed normally');
      } else if (event.code === 1006) {
        // Connection failed - try token refresh first
        console.log('WebSocket connection failed (code 1006)', { reason: event.reason });
        if (token && isTokenExpired(token)) {
          console.log('Connection failed due to expired token, attempting refresh...');
          tryRefreshAndReconnect();
        } else {
          // Auto-reconnect for other reasons
          setTimeout(() => {
            console.log('Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        }
      } else {
        console.log(`WebSocket closed with code ${event.code}:`, event.reason);
        // Show appropriate error message
        addToast({
          type: 'warning',
          title: 'Connection Lost',
          message: 'Connection to chat service lost. Attempting to reconnect...',
          duration: 5000
        });
      }
    };
  };
  
  // Handle room creation (when first message is sent)
  const handleRoomCreated = (roomId: string) => {
    console.log('Creating new chat room:', roomId);

    // Navigate to the new chat route (this will update URL param)
    navigate(`/chat/${roomId}`);

    // Use ref to ensure we get the latest messages (avoid stale closure)
    const session = currentSessionRef.current;

    if (session) {
      // Update current session ID with latest state
      setCurrentSession({
        ...session,
        id: roomId,
      });

      // Sync chat history: replace placeholder id or insert if absent
      const replaced = chatHistoryRef.current.map((chat) =>
        chat.id === session.id ? { ...chat, id: roomId } : chat
      );
      const exists = replaced.some((c) => c.id === roomId);
      const newHistory = exists ? replaced : [{ ...session, id: roomId }, ...replaced];
      setChatHistory(newHistory);
    }

    // Room created successfully; allow sending again
    setIsRoomCreating(false);

    // URL change will trigger effect to ensure WebSocket joins correct room
  };
  
  // Send message function
  const sendMessage = async () => {
    if (!message.trim()) {
      return;
    }
    if (!selectedAgent) {
      addToast({
        type: 'warning',
        title: 'Select Agent',
        message: 'Please select an AI agent before sending a message.',
        duration: 3000
      });
      return;
    }

    // Prevent duplicate sends while backend is creating a new room
    if (isRoomCreating) {
      addToast({
        type: 'info',
        title: 'Creating Room',
        message: 'Please wait while the chat room is being created…',
        duration: 2000
      });
      return;
    }

    // Add user message immediately for local rendering
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      images: images.length > 0 ? images : undefined
    };
    
    addMessage(userMessage);

    // สร้าง assistant placeholder เพื่อแสดงระหว่างสตรีม
    const placeholder: ChatMessage = {
      id: Date.now().toString() + '_assistant',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      isComplete: false
    };
    addMessage(placeholder);

    if (!currentSession!.id || currentSession!.id.startsWith('chat_')) {
      // need to create room first
      const createPayload = {
        type: 'create_room',
        name: currentSession?.name ?? 'New Chat',
        agent_id: selectedAgent?.id
      };

      // Always populate the pending ref for the first message
      pendingFirstRef.current = {
        text: message.trim(),
        images,
        agentId: selectedAgent?.id,
      };

      const sendCreate = () => {
        wsRef.current?.send(JSON.stringify(createPayload));
        setIsRoomCreating(true);
      };

      if (wsStatus === 'connected' && wsRef.current?.readyState === WebSocket.OPEN) {
        sendCreate();
      } else {
        pendingQueueRef.current.push(createPayload);
        // The ref is already populated above
        if (wsStatus !== 'connecting') connectWebSocket();
      }
    } else {
      const payloadToSend = {
        type: 'message',
        chatId: currentSession!.id,
        text: message.trim(),
        images,
        agent_id: selectedAgent?.id
      };

      if (wsStatus === 'connected' && wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(payloadToSend));
          setIsTyping(true);
        } catch (err) {
          console.error('Failed to send via existing WebSocket', err);
          addToast({ type: 'error', title: 'Send Error', message: 'Failed to send message' });
        }
      } else {
        pendingQueueRef.current.push(payloadToSend);
        if (wsStatus !== 'connecting') connectWebSocket();
        addToast({
          type: 'info',
          title: 'Connecting',
          message: 'Establishing chat connection…',
          duration: 2000
        });
        setIsTyping(true);
      }
    }

    // Clear input fields immediately
    setMessage('');
    setImages([]);
  };
  
  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(async (file) => {
      if (!file.type.startsWith('image/')) return;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post<{ url: string; mediaType: string }>(
          '/upload',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setImages(prev => [...prev, { url: res.url, mediaType: res.mediaType }]);
      } catch (err) {
        console.error('Image upload failed', err);
        addToast({ type: 'error', title: 'Upload Error', message: 'Failed to upload image' });
      }
    });
    
    // File input will be reset by ResponsiveChatInput component
  };
  
  // Handle remove image
  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };
  
  // Auto-reconnect when disconnected (but only if token is still valid)
  useEffect(() => {
    let reconnectTimer: number;
    
    if (wsStatus === 'disconnected' && token && currentSession && isInChatRoom) {
      // Check if token is still valid before attempting reconnect
      if (isTokenExpired(token)) {
        console.log('Token expired, not attempting reconnect');
        addToast({
          type: 'warning',
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again to continue chatting.',
          duration: 0
        });
        return;
      }
      
      // Try to reconnect after 3 seconds
      reconnectTimer = window.setTimeout(() => {
        console.log('Attempting to reconnect...');
        connectWebSocket();
      }, 3000);
    }
    
    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [wsStatus, token, currentSession, isInChatRoom]);
  
  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // We no longer force-close WebSocket when leaving a room; it will be
  // cleaned up on unmount or reused for the next room to avoid race conditions.
  
  if (isLoading) {
    return <Loading />;
  }
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-primary">Please log in to start chatting</h2>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* Chat messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="popLayout">
            {currentSession?.messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
              />
            ))}
          </AnimatePresence>
          
          {isTyping && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto w-full px-4">
          <ResponsiveChatInput
            message={message}
            onMessageChange={setMessage}
            onSendMessage={sendMessage}
            onImageUpload={handleImageUpload}
            images={images}
            onRemoveImage={handleRemoveImage}
            disabled={!selectedAgent || isTyping}
            isTyping={isTyping}
            hasMessages={hasMessages}
            isInChatRoom={isInChatRoom}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 