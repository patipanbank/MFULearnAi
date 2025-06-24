import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import { config } from '../../config/config';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import dindinAvatar from '../../assets/dindin.png';
import mfuLogo from '../../assets/dindin_logo_newchat.png';
import { FiChevronDown } from 'react-icons/fi';

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
  
  // Add state for scroll button visibility
  const [showScrollButton, setShowScrollButton] = useState(false);
  
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
  
  // Scroll to bottom immediately when loading old chats
  useEffect(() => {
    if (currentSession?.messages.length && chatId) {
      // Force scroll to bottom immediately when chat is loaded
      const scrollToBottom = () => {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            // Add a second scroll after a delay to handle any dynamic content
            setTimeout(() => {
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 200);
          });
        }
      };

      // Execute scroll immediately and after a short delay to handle any late-loading content
      scrollToBottom();
      // Also scroll after images might have loaded
      const timer = setTimeout(scrollToBottom, 500);

      return () => clearTimeout(timer);
    }
  }, [chatId, currentSession?.id]); // Only trigger when chat changes, not on every message update

  // Keep the existing smooth scroll for new messages
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }
    };

    // Scroll when new messages arrive or typing starts
    scrollToBottom();

    // Also scroll when images are loaded
    const messageImages = document.querySelectorAll('.message-image');
    messageImages.forEach(img => {
      if ((img as HTMLImageElement).complete) {
        scrollToBottom();
      } else {
        img.addEventListener('load', scrollToBottom);
      }
    });

    return () => {
      messageImages.forEach(img => {
        img.removeEventListener('load', scrollToBottom);
      });
    };
  }, [currentSession?.messages, isTyping]);
  
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
            const now = new Date();
            now.setHours(now.getHours() - 7); // ลบ 7 ชั่วโมงสำหรับข้อความ AI
            const assistantMsg: ChatMessage = {
              id: Date.now().toString() + '_assistant',
              role: 'assistant',
              content: data.data,
              timestamp: now,
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
    const now = new Date();
    now.setHours(now.getHours() - 7); // ลบ 7 ชั่วโมงสำหรับข้อความผู้ใช้ในแชทเก่า
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: now,
      images: images.length > 0 ? images : undefined
    };
    
    addMessage(userMessage);

    // Create assistant placeholder for streaming
    const placeholderTime = new Date();
    placeholderTime.setHours(placeholderTime.getHours() - 7); // ลบ 7 ชั่วโมงสำหรับข้อความ AI ในแชทเก่า
    const placeholder: ChatMessage = {
      id: Date.now().toString() + '_assistant',
      role: 'assistant',
      content: '',
      timestamp: placeholderTime,
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
  
  const formatMessageTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    // Add 7 hours to match Thai timezone
    date.setHours(date.getHours() + 7);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  
  // Handle scroll events
  useEffect(() => {
    const mainContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (!mainContainer) return;

    const handleScroll = () => {
      // Show button if scrolled up more than 200px from bottom
      const isScrolledUp = mainContainer.scrollHeight - mainContainer.scrollTop - mainContainer.clientHeight > 200;
      setShowScrollButton(isScrolledUp);
    };

    mainContainer.addEventListener('scroll', handleScroll);
    return () => mainContainer.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Scroll to bottom function
  const scrollToBottom = () => {
    const mainContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (mainContainer) {
      mainContainer.scrollTo({
        top: mainContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
  
  // Get last bot message
  const getLastBotMessage = () => {
    if (!currentSession?.messages.length) return null;
    
    // Find the last message from the bot (assistant)
    for (let i = currentSession.messages.length - 1; i >= 0; i--) {
      const msg = currentSession.messages[i];
      if (msg.role === 'assistant') {
        return msg;
      }
    }
    return null;
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
    <div className="flex h-screen flex-col bg-primary relative overflow-hidden">
      {/* Add a subtle background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(186,12,47) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}/>
      </div>
      
      {/* Chat Area - Centered with max width */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative">
        {/* Messages Container - Make it fill available space */}
        <div className="flex-1 overflow-hidden relative h-[calc(100vh-120px)]">
          {/* Welcome Message */}
          {!hasMessages && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <img 
                  src={mfuLogo}
                  alt="MFU Logo"
                  className="w-32 h-32 mx-auto mb-0.5"
                />
                <h2 className="text-2xl font-bold text-primary mb-0">Welcome</h2>
                <h3 
                  className="text-2xl font-bold mb-0.5"
                  style={{
                    background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {user?.firstName || 'Guest'}
                </h3>
                <p className="text-base text-secondary">How can I help you today?</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div 
            className="messages-container h-full overflow-y-auto overflow-x-hidden" 
            style={{ paddingBottom: '160px' }}
          >
            <div className="min-h-full px-1 sm:px-4 py-4">
              <div className="space-y-4">
                {hasMessages && currentSession?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end pr-[2%] sm:pr-[15%]' : 'justify-start pl-[2%] sm:pl-[15%]'} items-end space-x-2`}
                  >
                    {msg.role !== 'user' && (
                      <div className="flex-shrink-0">
                        <img 
                          src={dindinAvatar} 
                          alt="DINDIN AI" 
                          className="w-8 h-8 rounded-full shadow-md"
                        />
                      </div>
                    )}
                    <div className="flex flex-col max-w-[65%] sm:max-w-[70%]">
                      <div className={`text-xs mb-1 ${
                        msg.role === 'user' ? 'text-right text-muted' : 'text-left text-muted'
                      }`}>
                        {formatMessageTime(msg.timestamp)}
                      </div>
                      <div
                        className={`px-4 py-3 rounded-2xl shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'card text-primary rounded-bl-sm'
                        }`}
                      >
                        {msg.images && msg.images.length > 0 && (
                          <div className="mb-3 grid grid-cols-2 gap-3">
                            {msg.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={img.url}
                                alt="Uploaded"
                                className="rounded-lg max-w-full h-auto shadow-sm message-image"
                              />
                            ))}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">
                          {msg.content}
                          {msg.isStreaming && (
                            <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
                          )}
                        </div>
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-gradient-to-br from-[rgb(186,12,47)] to-[rgb(212,175,55)] rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md">
                          {getInitials()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <button
                    onClick={scrollToBottom}
                    className="fixed bottom-24 right-8 bg-white text-primary p-3 rounded-full shadow-xl hover:bg-gray-100 transition-all duration-200 z-[100] border-2 border-primary flex items-center gap-2"
                    style={{
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      transform: 'scale(1.1)'
                    }}
                    aria-label="Scroll to bottom"
                  >
                    <span className="text-sm font-medium">ล่างสุด</span>
                    <FiChevronDown className="w-5 h-5" />
                  </button>
                )}
                
                {isTyping && (
                  <div className="flex justify-start items-end space-x-2">
                    <div className="flex-shrink-0">
                      <img 
                        src={dindinAvatar} 
                        alt="DINDIN AI" 
                        className="w-8 h-8 rounded-full shadow-md opacity-50"
                      />
                    </div>
                    <div className="card px-4 py-2 rounded-2xl rounded-bl-sm shadow-sm">
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
            </div>
          </div>
        </div>
        
        {/* Input Area - Fixed at Bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-primary via-primary to-transparent pt-6">
          <div className="container mx-auto max-w-4xl px-4 pb-6">
            {/* Last Bot Message Preview */}
            {hasMessages && !isTyping && (
              <div className="mb-2 px-2">
                <div className="flex items-start space-x-2 opacity-75 hover:opacity-100 transition-opacity">
                  <img 
                    src={dindinAvatar} 
                    alt="DINDIN AI" 
                    className="w-6 h-6 rounded-full shadow-sm mt-1"
                  />
                  <div className="flex-1 text-sm text-white bg-black/20 rounded-xl px-3 py-2 backdrop-blur-sm">
                    {getLastBotMessage()?.content || ''}
                  </div>
                </div>
              </div>
            )}
            
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
  );
};

export default ChatPage; 