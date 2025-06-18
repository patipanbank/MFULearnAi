import React, { useState, useEffect, useRef } from 'react';
import { useChatStore, useModelsStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import { config } from '../../config/config';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';

const ChatPage: React.FC = () => {
  const { user, token } = useAuthStore();
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
    selectedModel, 
    selectedCollections,
    fetchModels, 
    fetchCollections  } = useModelsStore();
  
  const { setLoading, addToast } = useUIStore();
  
  // Local state
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Array<{ data: string; mediaType: string }>>([]);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true, 'Loading models and collections...');
      try {
        await Promise.all([
          fetchModels(),
          fetchCollections()
        ]);
      } catch (error) {
        console.error('Failed to initialize data:', error);
        addToast({
          type: 'error',
          title: 'Initialization Error',
          message: 'Failed to load models and collections'
        });
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, [fetchModels, fetchCollections, setLoading, addToast]);
  
  // Create new chat session if none exists
  useEffect(() => {
    if (!currentSession) {
      createNewChat();
    }
  }, [currentSession, createNewChat]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);
  
  // WebSocket connection management
  const connectWebSocket = () => {
    if (!token || !currentSession || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    setWsStatus('connecting');
    
    const wsUrl = `${config.wsUrl}/api/chat/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
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
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to connect to chat service. Retrying...',
        duration: 5000
      });
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket disconnected');
      setWsStatus('disconnected');
      wsRef.current = null;
      
      // Show disconnection toast only if it wasn't a clean close
      if (event.code !== 1000) {
        addToast({
          type: 'warning',
          title: 'Disconnected',
          message: 'Chat service disconnected. Click refresh to reconnect.',
          duration: 0 // Persistent until manually dismissed
        });
      }
    };
  };
  
  // Send message
  const sendMessage = async () => {
    if (!message.trim() || !selectedModel || !currentSession || !wsRef.current) {
      return;
    }
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      images: images.length > 0 ? images : undefined
    };
    
    addMessage(userMessage);
    
    // Add assistant placeholder message
    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      isComplete: false
    };
    
    addMessage(assistantMessage);
    setIsTyping(true);
    
    // Send to WebSocket
    const payload = {
      session_id: currentSession.id,
      message: message,
      model_id: selectedModel.id,
      collection_names: selectedCollections,
      images: images
    };
    
    try {
      wsRef.current.send(JSON.stringify(payload));
      
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
  
  // Connect WebSocket when component mounts or dependencies change
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, currentSession?.id]);

  // Auto-reconnect when disconnected
  useEffect(() => {
    let reconnectTimer: number;
    
    if (wsStatus === 'disconnected' && token && currentSession) {
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
  }, [wsStatus, token, currentSession]);
  
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
        
        {/* Responsive Chat Input */}
        <ResponsiveChatInput
          message={message}
          onMessageChange={setMessage}
          onSendMessage={sendMessage}
          onImageUpload={handleImageUpload}
          images={images}
          onRemoveImage={handleRemoveImage}
          disabled={wsStatus !== 'connected' || !selectedModel}
          isTyping={isTyping}
          hasMessages={(currentSession?.messages.length || 0) > 0}
        />
      </div>
    </div>
  );
};

export default ChatPage; 