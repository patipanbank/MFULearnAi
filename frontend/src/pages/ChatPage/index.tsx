import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import { config } from '../../config/config';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import { cn } from '../../shared/lib/utils';

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
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Keep a ref to always access latest session inside websocket callbacks
  const currentSessionRef = useRef<typeof currentSession>(null); // NEW REF
  
  // Queue of pending payloads when websocket is not yet connected
  type PendingPayload = {
    session_id: string;
    message: string;
    agent_id?: string;
    images: Array<{ url: string; mediaType: string }>;
  };

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
      // already assigned
      
      // Show connection success toast
      addToast({
        type: 'success',
        title: 'Connected',
        message: 'Chat service connected successfully',
        duration: 3000
      });
      
      // ส่งคิวข้อความที่ค้างทั้งหมด
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

    // Navigate to the new chat route (this will reset URL param)
    navigate(`/chat/${roomId}`);

    // Update current session ID in store so polling and subsequent sends use correct ID
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        id: roomId,
      });

      // Update chat history list: replace placeholder id
      const updatedHistory = chatHistory.map((chat) =>
        chat.id === currentSession.id ? { ...chat, id: roomId } : chat
      );
      // If not found, push new entry
      const exists = updatedHistory.some((c) => c.id === roomId);
      if (!exists) {
        updatedHistory.unshift({ ...currentSession, id: roomId });
      }
      setChatHistory(updatedHistory);
    }

    // Do not connect here; the URL change will trigger the effect that opens
    // a WebSocket for the new room. This prevents duplicate connections.
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

    const payloadToSend = {
      session_id: currentSession!.id,
      message: message.trim(),
      agent_id: selectedAgent?.id,
      images
    };

    if (wsStatus !== 'connected') {
      // queue payload; open socket only if we are already in a room
      pendingQueueRef.current.push(payloadToSend);
      if (isInChatRoom) {
        connectWebSocket();
      }
      // The actual send will occur in ws.onopen
      addToast({
        type: 'info',
        title: 'Connecting',
        message: 'Establishing chat connection…',
        duration: 2000
      });
      // Clear input fields immediately
      setMessage('');
      setImages([]);
      // Show typing indicator while waiting
      setIsTyping(true);
      return;
    }

    // ถ้า websocket เชื่อมแล้ว ส่งทันที
    try {
      wsRef.current?.send(JSON.stringify(payloadToSend));
      setIsTyping(true);
    } catch (err) {
      console.error('Failed to send message via WebSocket', err);
      addToast({ type: 'error', title: 'Send Error', message: 'Failed to send message' });
    }

    // Clear input
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
  
  // เมื่อออกจากห้องแชท (route /chat ไม่มี id) ให้ปิด WS และรีเซตสถานะการเชื่อมต่อ
  useEffect(() => {
    if (!isInChatRoom && wsStatus === 'connected') {
      // Leaving a room, close socket bound to that room
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      setIsConnectedToRoom(false);
    }
  }, [isInChatRoom, wsStatus]);
  
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
            disabled={(!isInChatRoom && !selectedAgent) || (isInChatRoom && wsStatus !== 'connected')}
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