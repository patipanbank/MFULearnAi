import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import { config } from '../../config/config';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';

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
    setIsTyping
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
  const [images, setImages] = useState<Array<{ data: string; mediaType: string }>>([]);
  const [isConnectedToRoom, setIsConnectedToRoom] = useState(false);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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
  
  // Handle chat room navigation
  useEffect(() => {
    if (isInChatRoom && chatId) {
      // Load specific chat room or create if doesn't exist
      if (!currentSession || currentSession.id !== chatId) {
        // In a real app, you'd load the chat from backend
        // For now, create a new session and then update its ID
        createNewChat();
        // Update the session ID after creation (this will be handled in the next useEffect)
      }
      // Connect to WebSocket when entering a chat room
      if (!isConnectedToRoom) {
        connectWebSocket();
      }
    } else if (!isInChatRoom && !currentSession) {
      // Create new chat session if none exists and we're on /chat
      createNewChat();
    }
  }, [chatId, isInChatRoom, currentSession, createNewChat]);
  
  // Update session ID when chat room changes
  useEffect(() => {
    if (isInChatRoom && chatId && currentSession && currentSession.id !== chatId) {
      // Update current session ID to match the chat room
      currentSession.id = chatId;
    }
  }, [chatId, isInChatRoom, currentSession]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);
  
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
  
  // WebSocket connection management
  const connectWebSocket = () => {
    if (!token || !currentSession || wsRef.current?.readyState === WebSocket.OPEN) {
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
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      setIsConnectedToRoom(true);
      wsRef.current = ws;
      
      // Show connection success toast
      addToast({
        type: 'success',
        title: 'Connected',
        message: 'Chat service connected successfully',
        duration: 3000
      });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          // Handle streaming response
          const lastMessage = currentSession?.messages[currentSession.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            updateMessage(lastMessage.id, {
              content: lastMessage.content + data.data
            });
          }
        } else if (data.type === 'end') {
          // Mark message as complete
          const lastMessage = currentSession?.messages[currentSession.messages.length - 1];
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
          setIsTyping(false);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to connect to chat service. Retrying...',
        duration: 5000
      });
    };

    ws.onclose = (event) => {
      setWsStatus('disconnected');
      setIsConnectedToRoom(false);
      wsRef.current = null;
      
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
    
    // Navigate to the new chat room
    navigate(`/chat/${roomId}`);
    
    // Update current session ID
    if (currentSession) {
      // In a real app, you'd update the session ID in the backend
      // For now, just update the local state
      currentSession.id = roomId;
    }
    
    // Connect to WebSocket for the new room
    connectWebSocket();
  };
  
  // Send message function
  const sendMessage = async () => {
    if (!message.trim() || !selectedAgent || wsStatus !== 'connected') {
      return;
    }
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      images: images.length > 0 ? images : undefined
    };
    
    addMessage(userMessage);
    
    // Add assistant placeholder
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      isComplete: false
    };
    
    addMessage(assistantMessage);
    setIsTyping(true);
    
    // Send to WebSocket - New Agent-based payload
    const payload = {
      session_id: currentSession!.id,
      message: message,
      agent_id: selectedAgent.id,
      images: images
    };
    
    try {
      wsRef.current!.send(JSON.stringify(payload));
      
      // Clear input
      setMessage('');
      setImages([]);
    } catch (error) {
      console.error('Failed to send message:', error);
      addToast({
        type: 'error',
        title: 'Send Error',
        message: 'Failed to send message'
      });
      setIsTyping(false);
    }
  };
  
  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
          
          setImages(prev => [...prev, {
            data: base64Data,
            mediaType: file.type
          }]);
        };
        reader.readAsDataURL(file);
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
                        src={`data:${img.mediaType};base64,${img.data}`}
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
        
        {/* Responsive Chat Input with new props */}
        <ResponsiveChatInput
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
  );
};

export default ChatPage; 