import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import dindinAvatar from '../../assets/dindin.png';
import dindinNp from '../../assets/dindin_np.PNG';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useChatNavigation } from '../../shared/hooks/useChatNavigation';
import { useChatInput } from '../../shared/hooks/useChatInput';

const ChatPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  
  const currentSession = useChatStore((state) => state.currentSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const isTyping = useChatStore((state) => state.isTyping);
  const setChatHistory = useChatStore((state) => state.setChatHistory);
  const isLoading = useChatStore((state) => state.isLoading);
  
  const selectedAgent = useAgentStore((state) => state.selectedAgent);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);
  
  const setLoading = useUIStore((state) => state.setLoading);
  const addToast = useUIStore((state) => state.addToast);
  
  // Navigation
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  
  // Determine if we're in a specific chat room
  const isInChatRoom = Boolean(chatId);
  const hasMessages = (currentSession?.messages.length || 0) > 0;

  // Custom hooks
  const {
    wsRef,
    pendingFirstRef,
    pendingQueueRef,
    connectWebSocket,
    handleRoomCreated,
    isTokenExpired,
    tryRefreshToken
  } = useWebSocket({ chatId, isInChatRoom });

  // Chat navigation is handled by useChatNavigation hook
  useChatNavigation({ chatId, isInChatRoom, connectWebSocket });

  const {
    message,
    setMessage,
    images,
    setImages,
    messagesEndRef
  } = useChatInput();

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true, 'Loading agents...');
      try {
        await fetchAgents();
        // Filter chat history only once on mount, not on every chatHistory change
        const currentChatHistory = useChatStore.getState().chatHistory;
        setChatHistory(currentChatHistory.filter((c) => c.id && c.id.length === 24));
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
  }, [fetchAgents, setChatHistory, setLoading, addToast]);

  // Auto-reconnect when disconnected (but only if token is still valid)
  useEffect(() => {
    let reconnectTimer: number;
    
    const handleReconnect = async () => {
      if (wsStatus === 'disconnected' && token && currentSession && isInChatRoom) {
        // Check if token is still valid before attempting reconnect
        if (isTokenExpired(token)) {
          console.log('Token expired, attempting refresh...');
          const refreshSuccess = await tryRefreshToken();
          if (!refreshSuccess) {
            addToast({
              type: 'warning',
              title: 'Session Expired',
              message: 'Your session has expired. Please log in again to continue chatting.',
              duration: 0
            });
            return;
          }
        }
        
        // Try to reconnect after 3 seconds
        reconnectTimer = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      }
    };
    
    handleReconnect();
    
    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [wsStatus, token, currentSession, isInChatRoom, isTokenExpired, addToast, connectWebSocket, tryRefreshToken]);

  // Handle room creation (when first message is sent)
  const handleRoomCreatedWithNavigate = useCallback((roomId: string) => {
    handleRoomCreated(roomId, navigate);
  }, [handleRoomCreated, navigate]);

  // Send message function
  const sendMessage = useCallback(async () => {
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
    const userTimestamp = new Date();
    userTimestamp.setHours(userTimestamp.getHours() - 7);
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: userTimestamp,
      images: images.length > 0 ? images : undefined
    };

    // Add message to session
    addMessage(userMessage);

    // Clear input
    setMessage('');
    setImages([]);

    // Prepare message payload
    const messagePayload = {
      type: 'message',
      text: message.trim(),
      images: images,
      agent_id: selectedAgent.id
    };

    // Check if we're in a chat room
    if (isInChatRoom && chatId && chatId.length === 24) {
      // Send to existing room
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          ...messagePayload,
          chatId: chatId
        }));
      } else {
        // Queue message if WebSocket not ready
        pendingQueueRef.current.push({
          ...messagePayload,
          chatId: chatId
        });
      }
    } else {
      // Create new room
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Store first message for when room is created
        pendingFirstRef.current = {
          text: message.trim(),
          images: images,
          agentId: selectedAgent.id
        };

        // Send create room request
        wsRef.current.send(JSON.stringify({
          type: 'create_room',
          agent_id: selectedAgent.id
        }));
      } else {
        // Queue create room request
        pendingQueueRef.current.push({
          type: 'create_room',
          agent_id: selectedAgent.id
        });
        
        // Store first message for when room is created
        pendingFirstRef.current = {
          text: message.trim(),
          images: images,
          agentId: selectedAgent.id
        };
      }
    }
  }, [message, images, selectedAgent, addMessage, setMessage, setImages, isInChatRoom, chatId, wsRef, pendingQueueRef, pendingFirstRef, addToast]);

  // Handle image upload
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > maxSize) {
        addToast({
          type: 'error',
          title: 'File Too Large',
          message: `${file.name} is too large. Maximum size is 5MB.`
        });
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        addToast({
          type: 'error',
          title: 'Invalid File Type',
          message: `${file.name} is not a supported image type.`
        });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<{ url: string }>('/upload/image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        setImages(prev => [...prev, { url: response.url, mediaType: file.type }]);
      } catch (error) {
        console.error('Failed to upload image:', error);
        addToast({
          type: 'error',
          title: 'Upload Failed',
          message: `Failed to upload ${file.name}`
        });
      }
    }
    
    // File input will be reset by ResponsiveChatInput component
  }, [addToast, setImages]);

  // Handle remove image
  const handleRemoveImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, [setImages]);

  // Get user initials for avatar
  const getInitials = useCallback(() => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  }, [user]);

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
    <div className="flex h-full bg-primary relative">
      {/* Add a subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(186,12,47) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}/>
      </div>
      
      {/* Chat Area - Full width */}
      <div className="flex-1 flex flex-col w-full relative h-full overflow-hidden">
        {/* Messages */}
        {hasMessages ? (
        <div className="flex-1 overflow-y-auto px-0 sm:px-4 py-4 pb-32 space-y-4 h-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
          {currentSession?.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'user' 
                  ? 'justify-end sm:mr-4 md:mr-8 lg:mr-[230px] 2xl:mr-[485px]' 
                  : 'justify-start ml-0 sm:ml-4 md:ml-8 lg:ml-[245px] 2xl:ml-[500px]'
              } items-end space-x-2 px-1 sm:px-2`}
            >
              {msg.role !== 'user' && (
                <div className="flex-shrink-0 ml-1 sm:ml-0">
                  <img 
                    src={dindinAvatar} 
                    alt="DINDIN AI" 
                    className="w-8 h-8 sm:w-8 sm:h-8 rounded-full shadow-md"
                  />
                </div>
              )}
              <div className="flex flex-col max-w-[75%] sm:max-w-[65%] md:max-w-[60%] lg:max-w-[55%] 2xl:max-w-[50%]">
                {/* Timestamp */}
                <div className={`text-[10px] sm:text-xs mb-1 ${
                  msg.role === 'user' ? 'text-right text-muted' : 'text-left text-muted'
                }`}>
                  {msg.role === 'user'
                    ? (() => { const d = new Date(msg.timestamp); d.setHours(d.getHours() + 7); return d.toLocaleTimeString(); })()
                    : msg.timestamp.toLocaleTimeString()}
                </div>
                <div
                  className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'card text-primary rounded-bl-sm'
                  }`}
                >
                  {/* Images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="mb-3 grid grid-cols-2 gap-2 sm:gap-3">
                      {msg.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img.url}
                          alt="Uploaded"
                          className="rounded-lg max-w-full h-auto shadow-sm"
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Message Content */}
                  <div className="whitespace-pre-wrap text-base sm:text-base">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-2 sm:w-2 h-5 sm:h-5 bg-current animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 sm:h-8 sm:w-8 bg-gradient-to-br from-[rgb(186,12,47)] to-[rgb(212,175,55)] rounded-full flex items-center justify-center text-white text-sm sm:text-sm font-medium shadow-md">
                    {getInitials()}
                  </div>
                </div>
              )}
            </div>
          ))}
          
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
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <img 
                src={dindinNp} 
                alt="DINDIN AI"
                className="w-32 h-32 mx-auto mb-3 rounded-full"
              />
              <h1 className="text-2xl font-bold text-primary mb-1">Welcome</h1>
              <h2 
                className="text-2xl font-bold mb-1 bg-gradient-to-r from-[rgb(186,12,47)] to-[rgb(212,175,55)] text-transparent bg-clip-text"
              >{user?.firstName || 'Guest'}</h2>
              <h3 className="text-lg text-primary">How can I help you today?</h3>
            </div>
          </div>
        )}
        
        {/* Input Area - Fixed at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary via-primary to-transparent pt-6">
          <div className="px-4 pb-6">
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
              onRoomCreated={handleRoomCreatedWithNavigate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 