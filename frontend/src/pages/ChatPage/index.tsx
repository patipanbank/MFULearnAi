import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import { cn } from '../../shared/lib/utils';
import { chatWebSocket } from '../../shared/lib/chatWebSocket';

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
    if (!currentSession) createNewChat();
  }, [isInChatRoom]);
  
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
  
  // WebSocket connection management (wrapper to centralised manager)
  const connectWebSocket = () => {
    if (!token) return;
    setWsStatus('connecting');
    chatWebSocket.connect(token);
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
      // 🛠️ Ensure we don't send create_room through a socket still bound to the previous chat room
      //    Close it first and mark status disconnected; connectWebSocket() will open a fresh one.
      //    if (!isInChatRoom && wsStatus === 'connected' && wsRef.current) {
      //      wsRef.current.close();
      //      setWsStatus('disconnected');
      //    }
      // need to create room first
      const createPayload = {
        type: 'create_room',
        name: currentSession?.name ?? 'New Chat',
        agent_id: selectedAgent?.id
      };

      const sendCreate = () => {
        chatWebSocket.send(createPayload);
        setIsRoomCreating(true);
        pendingFirstRef.current = {
          text: message.trim(),
          images,
          agentId: selectedAgent?.id,
        };
      };

      if (chatWebSocket.getStatus() === 'connected') {
        sendCreate();
      } else {
        sendCreate(); // queued inside manager
        if (chatWebSocket.getStatus() === 'disconnected') {
          chatWebSocket.connect(token!);
        }
      }
    } else {
      const payloadToSend = {
        type: 'message',
        chatId: currentSession!.id,
        text: message.trim(),
        images,
        agent_id: selectedAgent?.id
      };

      if (chatWebSocket.getStatus() === 'connected') {
        chatWebSocket.send(payloadToSend);
        setIsTyping(true);
      } else {
        chatWebSocket.send(payloadToSend); // queued
        if (chatWebSocket.getStatus() === 'disconnected') {
          chatWebSocket.connect(token!);
        }
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
  
  // When URL is /chat (no specific room), decide whether to keep or close existing WebSocket.
  // If currentSession.id is a temporary "chat_" id we KEEP the socket because we still need it
  //   to send create_room and wait for room_created.  Otherwise (leaving an existing room with a
  //   real 24-char id) we close it.
  useEffect(() => {
    if (!isInChatRoom) {
      const curId = currentSession?.id;
      const isTempId = curId?.startsWith('chat_');
      if (!isTempId && wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
      if (!isTempId) {
        setIsConnectedToRoom(false);
      }
    }
  }, [isInChatRoom, currentSession?.id]);
  
  // ---------- WebSocket via centralised manager ----------
  // Connect / reconnect whenever token changes
  useEffect(() => {
    if (token) {
      chatWebSocket.connect(token);
    }
  }, [token]);

  // Subscribe to events emitted by chatWebSocket
  useEffect(() => {
    const listener = (payload: { type: string; data?: any }) => {
      if (payload.type === 'status') {
        setWsStatus(payload.data as any);
        if (payload.data === 'connected') setIsConnectedToRoom(true);
        if (payload.data === 'disconnected' || payload.data === 'error') setIsConnectedToRoom(false);
      } else if (payload.type === 'chunk' || payload.type === 'end' || payload.type === 'error') {
        // Re-emit to existing handlers by mimicking original ws.onmessage structure
        handleWebSocketEvent(payload);
      } else if (payload.type === 'room_created') {
        const { chatId } = payload.data || {};
        if (chatId) {
          handleRoomCreated(chatId);
          if (pendingFirstRef.current) {
            const { text, images: pImages, agentId: pAgentId } = pendingFirstRef.current;
            const msgPayload = {
              type: 'message',
              chatId,
              text,
              images: pImages,
              agent_id: pAgentId,
            };
            chatWebSocket.send(msgPayload);
            pendingFirstRef.current = null;
          }
        }
      }
    };
    chatWebSocket.on(listener);
    return () => chatWebSocket.off(listener);
  }, []);

  // Helper to reuse existing logic for chunk/end/error
  const handleWebSocketEvent = (data: any) => {
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
    } else if (data.type === 'end') {
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
      addToast({ type: 'error', title: 'Chat Error', message: data.data });
      abortStreaming('ERROR');
    }
  };
  
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
    <div className="flex h-full bg-primary">
      {/* Chat Area - Full Width without Header */}
      <div className="flex-1 flex flex-col max-w-none">
        {/* Messages */}
        {hasMessages && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {currentSession?.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl px-4 py-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'card text-primary'
                }`}
              >
                {/* Images */}
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {msg.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img.url}
                        alt="Uploaded"
                        className="rounded-lg max-w-full h-auto"
                      />
                    ))}
                  </div>
                )}
                
                {/* Message Content */}
                <div className="whitespace-pre-wrap">
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
                  )}
                </div>
                
                {/* Timestamp */}
                <div className={`text-xs mt-2 ${
                  msg.role === 'user' ? 'text-blue-100' : 'text-muted'
                }`}>
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="card px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        )}
        
        {/* Chat Input Wrapper */}
        <div
          className={cn(
            hasMessages
              ? 'pt-2 pb-4 border-t'
              : 'flex-1 flex items-center justify-center'
          )}
        >
          <ResponsiveChatInput
            key={currentSession?.id || 'no-session'}
            message={message}
            onMessageChange={setMessage}
            onSendMessage={sendMessage}
            onImageUpload={handleImageUpload}
            images={images}
            onRemoveImage={handleRemoveImage}
            disabled={isRoomCreating || (!isInChatRoom && !selectedAgent) || (isInChatRoom && wsStatus !== 'connected')}
            isTyping={isTyping}
            hasMessages={hasMessages}
            isConnectedToRoom={isConnectedToRoom}
            onRoomCreated={handleRoomCreated}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 