import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import { config } from '../../config/config';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import dindinAvatar from '../../assets/dindin.png';

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
  
  // Get user initials for avatar
  const getInitials = () => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
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
      {/* Chat Area - Centered with max width */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-4xl flex-1 flex flex-col relative">
          {/* Messages */}
          {hasMessages && (
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-4">
              {currentSession?.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} max-w-3xl mx-auto`}
                >
                  {msg.role !== 'user' && (
                    <div className="flex-shrink-0 mr-3">
                      <img 
                        src={dindinAvatar} 
                        alt="DINDIN AI" 
                        className="w-8 h-8 rounded-full shadow-md dark:shadow-primary/10"
                      />
                    </div>
                  )}
                  <div className="flex flex-col">
                    {/* Timestamp */}
                    <div className={`text-xs mb-1 ${
                      msg.role === 'user' ? 'text-right text-muted' : 'text-left text-muted'
                    }`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                    <div
                      className={`max-w-xl w-fit px-4 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white ml-4 shadow-md'
                          : 'bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-sm text-white mr-4 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out border border-gray-700/30 hover:border-gray-600/40'
                      }`}
                    >
                      {/* Images */}
                      {msg.images && msg.images.length > 0 && (
                        <div className="mb-3 grid grid-cols-2 gap-3">
                          {msg.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img.url}
                              alt="Uploaded"
                              className="rounded-lg max-w-full h-auto shadow-sm hover:shadow-md transition-shadow duration-200 dark:shadow-primary/10"
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className="whitespace-pre-wrap text-[15px] leading-relaxed tracking-wide">
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
                        )}
                      </div>
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 ml-3">
                      <div className="h-8 w-8 bg-gradient-to-br from-[rgb(186,12,47)] to-[rgb(212,175,55)] rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md dark:shadow-primary/10">
                        {getInitials()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start max-w-3xl mx-auto">
                  <div className="flex items-center space-x-3 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-lg border border-gray-700/30">
                    <img 
                      src={dindinAvatar} 
                      alt="DINDIN AI" 
                      className="w-7 h-7 rounded-full ring-2 ring-gray-600/30"
                    />
                    <div className="flex space-x-2">
                      <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" />
                      <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
          
          {/* Welcome Message when no messages */}
          {!hasMessages && !isLoading && (
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="text-center space-y-4 max-w-lg">
                <img 
                  src={dindinAvatar} 
                  alt="DINDIN AI" 
                  className="w-20 h-20 mx-auto rounded-full shadow-xl dark:shadow-primary/10 mb-6"
                />
                <h1 className="text-2xl font-semibold text-primary">Welcome to DINDIN AI Chat</h1>
                <p className="text-muted text-lg">
                  I'm here to help you with any questions or tasks you have. Feel free to start a conversation!
                </p>
              </div>
            </div>
          )}
          
          {/* Input Area - Fixed at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary via-primary to-transparent pt-6">
            <div className="px-4 pb-6 max-w-3xl mx-auto">
              <ResponsiveChatInput
                message={message}
                onMessageChange={setMessage}
                onSendMessage={sendMessage}
                onImageUpload={handleImageUpload}
                images={images}
                onRemoveImage={handleRemoveImage}
                disabled={!selectedAgent || isLoading}
                isTyping={isTyping}
                hasMessages={hasMessages}
                isInChatRoom={isInChatRoom}
                onRoomCreated={handleRoomCreated}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 