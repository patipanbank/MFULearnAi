import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { ToolUsageDisplay } from '../../shared/ui/ToolUsageDisplay';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
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
    isTokenExpired,
    tryRefreshToken,
    sendMessage: wsSendMessage
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

  // Enhanced scroll behavior - scroll to latest user message
  const scrollToLatestMessage = useCallback(() => {
    if (currentSession?.messages?.length) {
      const messagesContainer = messagesEndRef.current?.parentElement;
      if (messagesContainer) {
        // Find the last user message element
        const userMessages = messagesContainer.querySelectorAll('.user-message');
        const lastUserMessage = userMessages[userMessages.length - 1];
        
        if (lastUserMessage) {
          // Scroll so the user message is near the top
          const elementTop = (lastUserMessage as HTMLElement).offsetTop;
          const scrollTarget = Math.max(0, elementTop - 100); // 100px from top
          
          messagesContainer.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentSession?.messages?.length, messagesEndRef]);

  // Trigger scroll when new messages are added
  useEffect(() => {
    if (currentSession?.messages && currentSession.messages.length > 0) {
      const lastMessage = currentSession.messages[currentSession.messages.length - 1];
      if (lastMessage?.role === 'user') {
        // Delay scroll to ensure DOM is updated
        setTimeout(scrollToLatestMessage, 100);
      }
    }
  }, [currentSession?.messages?.length, scrollToLatestMessage]);

  // Debug function to test WebSocket connection
  const debugWebSocket = useCallback(() => {
    console.log('=== WebSocket Debug Info ===');
    console.log('WebSocket ref:', wsRef.current);
    console.log('WebSocket readyState:', wsRef.current?.readyState);
    console.log('Is in chat room:', isInChatRoom);
    console.log('Chat ID:', chatId);
    console.log('Current session:', currentSession);
    console.log('Selected agent:', selectedAgent);
    console.log('Pending queue:', pendingQueueRef.current);
    console.log('Pending first:', pendingFirstRef.current);
    console.log('===========================');
  }, [wsRef, isInChatRoom, chatId, currentSession, selectedAgent, pendingQueueRef, pendingFirstRef]);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      console.log('ChatPage: Initializing data...');
      setLoading(true, 'Loading agents...');
      try {
        await fetchAgents();
        console.log('ChatPage: Agents loaded successfully');
        // Filter chat history only once on mount, not on every chatHistory change
        const currentChatHistory = useChatStore.getState().chatHistory;
        setChatHistory(currentChatHistory.filter((c) => c.id && c.id.length === 24));
        console.log('ChatPage: Chat history filtered');
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
    console.log('Room created, navigating to:', `/chat/${roomId}`);
    // ใช้ navigate function โดยตรง
    navigate(`/chat/${roomId}`);
  }, [navigate]);

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

    console.log('ChatPage: Sending message', { message: message.trim(), agentId: selectedAgent.id, isInChatRoom, chatId });

    // ตรวจสอบ WebSocket connection
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('ChatPage: WebSocket not ready, attempting to connect...');
      connectWebSocket();
      
      // รอสักครู่แล้วลองใหม่
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('ChatPage: WebSocket connected, retrying send...');
          sendMessage();
        } else {
          addToast({
            type: 'error',
            title: 'Connection Error',
            message: 'Unable to connect to chat service. Please try again.',
            duration: 5000
          });
        }
      }, 1000);
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

    // Note: messagePayload is no longer used since we use wsSendMessage function

    // Check if we're in a chat room
    if (isInChatRoom && chatId && chatId.length === 24) {
      console.log('ChatPage: Sending to existing room', chatId);
      // ใช้ sendMessage function ที่ปรับปรุงแล้ว
      wsSendMessage(message.trim(), images, selectedAgent?.id);
    } else {
      console.log('ChatPage: Creating new room');
      // Create new room
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Store first message for when room is created
        pendingFirstRef.current = {
          text: message.trim(),
          images: images,
          agentId: selectedAgent.id
        };

        // Send create room request
        const createRoomPayload = {
          type: 'create_room',
          agent_id: selectedAgent.id
        };
        console.log('ChatPage: WebSocket ready, creating room', createRoomPayload);
        wsRef.current.send(JSON.stringify(createRoomPayload));
      } else {
        console.log('ChatPage: WebSocket not ready, queuing create room request');
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
  }, [message, images, selectedAgent, addMessage, setMessage, setImages, isInChatRoom, chatId, wsRef, pendingQueueRef, pendingFirstRef, addToast, connectWebSocket, wsSendMessage]);

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

  // Render assistant content with rich formatting
  const renderAssistantContent = useCallback((content: string) => {
    // Split content by double newlines to identify potential sections
    const sections = content.split('\n\n');
    
    return sections.map((section, index) => {
      const trimmedSection = section.trim();
      if (!trimmedSection) return null;
      
      // Check if section starts with # (header)
      if (trimmedSection.startsWith('# ')) {
        return (
          <h1 key={index} className="text-3xl font-bold mb-4 mt-6 text-primary border-b border-border pb-2">
            {trimmedSection.substring(2)}
          </h1>
        );
      }
      
      // Check if section starts with ## (subheader)  
      if (trimmedSection.startsWith('## ')) {
        return (
          <h2 key={index} className="text-2xl font-semibold mb-3 mt-5 text-primary">
            {trimmedSection.substring(3)}
          </h2>
        );
      }
      
      // Check if section starts with ### (sub-subheader)
      if (trimmedSection.startsWith('### ')) {
        return (
          <h3 key={index} className="text-xl font-medium mb-2 mt-4 text-primary">
            {trimmedSection.substring(4)}
          </h3>
        );
      }
      
      // Check if section contains code blocks
      if (trimmedSection.includes('```')) {
        const parts = trimmedSection.split('```');
        return (
          <div key={index} className="mb-4">
            {parts.map((part, partIndex) => {
              if (partIndex % 2 === 1) {
                // This is a code block
                const lines = part.split('\n');
                const language = lines[0] || 'text';
                const code = lines.slice(1).join('\n');
                
                return (
                  <div key={partIndex} className="my-4 rounded-lg overflow-hidden border border-border">
                    <div className="bg-secondary px-4 py-2 text-sm text-muted border-b border-border">
                      {language}
                    </div>
                    <pre className="bg-card p-4 overflow-x-auto">
                      <code className="text-sm text-primary font-mono">{code}</code>
                    </pre>
                  </div>
                );
              } else {
                // Regular text
                return part && (
                  <div key={partIndex} className="whitespace-pre-wrap">
                    {formatTextContent(part)}
                  </div>
                );
              }
            })}
          </div>
        );
      }
      
      // Check if section is a list
      if (trimmedSection.includes('\n- ') || trimmedSection.includes('\n* ') || trimmedSection.includes('\n1. ')) {
        const lines = trimmedSection.split('\n');
        const listItems: string[] = [];
        const nonListLines: string[] = [];
        
        lines.forEach(line => {
          if (line.trim().match(/^[-*]\s/) || line.trim().match(/^\d+\.\s/)) {
            listItems.push(line.trim());
          } else {
            nonListLines.push(line);
          }
        });
        
        return (
          <div key={index} className="mb-4">
            {nonListLines.length > 0 && (
              <div className="whitespace-pre-wrap mb-2">
                {formatTextContent(nonListLines.join('\n'))}
              </div>
            )}
            {listItems.length > 0 && (
              <ul className="list-disc list-inside space-y-1 ml-4">
                {listItems.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-primary">
                    {item.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, '')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <div key={index} className="mb-4 text-base leading-relaxed whitespace-pre-wrap">
          {formatTextContent(trimmedSection)}
        </div>
      );
    }).filter(Boolean);
  }, []);

  // Format text content with basic markdown-like features
  const formatTextContent = useCallback((text: string) => {
    // Handle bold text
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Handle italic text
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Handle inline code
    formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-secondary px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  }, []);

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
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-6 h-full chat-messages">
          {currentSession?.messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`message-container ${msg.role === 'user' ? 'user-message' : 'assistant-message'} animate-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {msg.role === 'user' ? (
                // User Message - Compact bubble on the right
                <div className="flex justify-end">
                  <div className="max-w-[80%] lg:max-w-[60%]">
                    <div className="message-bubble bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-lg">
                      {/* Images */}
                      {msg.images && msg.images.length > 0 && (
                        <div className="mb-3 grid grid-cols-2 gap-2">
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
                      <div className="text-base leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Assistant Message - Full width canvas-style
                <div className="w-full">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    {/* Images */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {msg.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img.url}
                            alt="AI Response"
                            className="rounded-xl max-w-full h-auto shadow-md"
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Message Content - Rich Display */}
                    <div className="assistant-content text-primary leading-relaxed">
                      {renderAssistantContent(msg.content)}
                      {msg.isStreaming && (
                        <span className="inline-block w-3 h-6 bg-blue-500 animate-pulse ml-1 rounded-sm" />
                      )}
                    </div>
                    
                    {/* Tool Usage Display */}
                    {msg.toolUsage && msg.toolUsage.length > 0 && (
                      <div className="mt-4">
                        <ToolUsageDisplay toolUsage={msg.toolUsage} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="w-full animate-in slide-in-from-bottom-2 duration-300">
              <div className="typing-indicator flex items-center space-x-3 py-4 px-6 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border-l-4 border-blue-400">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  DINDIN AI กำลังคิด...
                </span>
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
            {/* Debug button - only show in development */}
            {import.meta.env.DEV && (
              <button
                onClick={debugWebSocket}
                className="mb-2 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
              >
                Debug WebSocket
              </button>
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
              onRoomCreated={handleRoomCreatedWithNavigate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 