import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiCopy, FiEdit3, FiTrash2, FiMoreHorizontal } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import { useChatOptimized, useChatHistory, useChatMessages, useChatActions } from '../../shared/hooks/useChatOptimized';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { ToolUsageDisplay } from '../../shared/ui/ToolUsageDisplay';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import dindinAvatar from '../../assets/dindin.png';
import dindinNp from '../../assets/dindin_np.PNG';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useChatNavigation } from '../../shared/hooks/useChatNavigation';
import { useChatInput } from '../../shared/hooks/useChatInput';
import { VirtualChatList } from '../../shared/components/VirtualChatList';
import { PerformanceMonitor } from '../../shared/components/PerformanceMonitor';

const ChatPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  // Use optimized hooks for better performance
  const currentSession = useChatOptimized().currentSession;
  const wsStatus = useChatOptimized().wsStatus;
  const isTyping = useChatOptimized().isTyping;

  const { addMessage, updateMessage, setIsTyping, setChatHistory } = useChatActions();
  const messages = useChatMessages();

  // Message actions state
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  
  const selectedAgent = useAgentStore((state) => state.selectedAgent);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);
  
  const setLoading = useUIStore((state) => state.setLoading);
  const isLoading = useUIStore((state) => state.isLoading);
  const addToast = useUIStore((state) => state.addToast);
  
  // Navigation
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  
  // Determine if we're in a specific chat room
  const isInChatRoom = Boolean(chatId);
  const hasMessages = (currentSession?.messages.length || 0) > 0;

  // Custom hooks
  const {
    connectWebSocket,
    sendMessage: wsSendMessage,
    wsManager,
    pendingFirstRef
  } = useWebSocket({ chatId, isInChatRoom });

  // Chat navigation is handled by useChatNavigation hook
  useChatNavigation({ chatId, isInChatRoom, connectWebSocket });

  const {
    message,
    setMessage,
    images,
    setImages
  } = useChatInput();

  // File upload state
  const [files, setFiles] = useState<Array<{ url: string; name: string; type: string; size: number }>>([]);

  // Debug function to test WebSocket connection
  const debugWebSocket = useCallback(() => {
    console.log('=== WebSocket Debug Info ===');
    console.log('WebSocket Manager:', wsManager);
    console.log('WebSocket Status:', wsStatus);
    console.log('Is in chat room:', isInChatRoom);
    console.log('Chat ID:', chatId);
    console.log('Current session:', currentSession);
    console.log('Selected agent:', selectedAgent);
    console.log('Pending first:', pendingFirstRef.current);
    console.log('===========================');
  }, [wsManager, wsStatus, isInChatRoom, chatId, currentSession, selectedAgent, pendingFirstRef]);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      console.log('ChatPage: Initializing data...');
      setLoading(true, 'Loading agents...');
      try {
        await fetchAgents();
        console.log('ChatPage: Agents loaded successfully');
        // Filter chat history only once on mount, not on every chatHistory change
        const chatHistory = useChatHistory();
        setChatHistory(chatHistory.filter((c) => c.id && c.id.length === 24));
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
  }, [wsStatus, token, currentSession, isInChatRoom, addToast, connectWebSocket]);

  // Handle room creation (when first message is sent)
  const handleRoomCreatedWithNavigate = useCallback((roomId: string) => {
    console.log('Room created, navigating to:', `/chat/${roomId}`);
    // ใช้ navigate function โดยตรง
    navigate(`/chat/${roomId}`);
  }, [navigate]);

  // Send message function
  const sendMessage = useCallback(async () => {
    if (!message.trim() && images.length === 0) {
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

    // Clear input immediately
    const messageToSend = message.trim();
    const imagesToSend = [...images];
    setMessage('');
    setImages([]);

    // Show processing state
    setIsTyping(true);

    try {
      // Use the WebSocket send message function
      wsSendMessage(messageToSend, imagesToSend, selectedAgent?.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      addToast({
        type: 'error',
        title: 'Send Failed',
        message: 'Failed to send message. Please try again.',
        duration: 5000
      });
      // Restore message if sending failed
      setMessage(messageToSend);
      setImages(imagesToSend);
      setIsTyping(false);
    }
  }, [message, images, selectedAgent, setMessage, setImages, setIsTyping, addToast, wsSendMessage, isInChatRoom, chatId]);

  // Handle image upload
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🖼️ Image upload triggered:', {
      filesCount: event.target.files?.length || 0,
      selectedAgent: selectedAgent?.name,
      agentModel: selectedAgent?.modelId,
      isVisionCapable: selectedAgent?.modelId?.includes('claude-3'),
      disabled: !selectedAgent || isLoading,
      isTyping: isTyping
    });

    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('⚠️ No files selected');
      return;
    }

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

        const response = await api.post<{ url: string; mediaType: string }>('/upload/image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('🖼️ Upload response:', response);
        setImages(prev => [...prev, { url: response.url, mediaType: response.mediaType || file.type }]);
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

  // Handle file upload for documents
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 File upload triggered');

    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      console.log('⚠️ No files selected');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];

      if (file.size > maxSize) {
        addToast({
          type: 'error',
          title: 'File Too Large',
          message: `${file.name} is too large. Maximum size is 10MB.`
        });
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        addToast({
          type: 'error',
          title: 'Invalid File Type',
          message: `${file.name} is not supported. Only PDF, DOCX, and TXT files are allowed.`
        });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<{ url: string; filename: string }>('/upload/document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('📁 Upload response:', response);
        setFiles(prev => [...prev, {
          url: response.url,
          name: response.filename || file.name,
          type: file.type,
          size: file.size
        }]);

        addToast({
          type: 'success',
          title: 'File Uploaded',
          message: `${file.name} uploaded successfully`
        });
      } catch (error) {
        console.error('📁 Upload error:', error);
        addToast({
          type: 'error',
          title: 'Upload Failed',
          message: `Failed to upload ${file.name}`
        });
      }
    }

    // Clear input
    event.target.value = '';
  }, [addToast]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Get user initials for avatar
  const getInitials = useCallback(() => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  }, [user]);

  // Message Actions
  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      addToast({
        type: 'success',
        title: 'Copied',
        message: 'Message copied to clipboard'
      });
    } catch (error) {
      console.error('Failed to copy message:', error);
      addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Failed to copy message to clipboard'
      });
    }
    setActiveMessageMenu(null);
  }, [addToast]);

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setEditingMessage(messageId);
    setEditingContent(content);
    setActiveMessageMenu(null);
  }, []);

  const handleSaveEdit = useCallback(async (messageId: string) => {
    if (!editingContent.trim()) return;

    updateMessage(messageId, { content: editingContent.trim() });
    setEditingMessage(null);
    setEditingContent('');

    addToast({
      type: 'success',
      title: 'Message Updated',
      message: 'Message has been updated'
    });
  }, [editingContent, updateMessage, addToast]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditingContent('');
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!currentSession) return;

    try {
      // Mark message as deleted
      updateMessage(messageId, { content: '[Message deleted]' });

      addToast({
        type: 'success',
        title: 'Message Deleted',
        message: 'Message has been deleted'
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete message'
      });
    }
    setActiveMessageMenu(null);
  }, [currentSession, updateMessage, addToast]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeMessageMenu) {
        setActiveMessageMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMessageMenu]);

  // Enhanced Message Content Component with Markdown support
  const MessageContent: React.FC<{ content: string; role: 'user' | 'assistant' | 'system' }> = ({ content, role }) => {
    // Check for JSON delta patterns and extract only the delta content
    if (typeof content === 'string' && content.trim().startsWith('{') && content.includes('"delta":')) {
      try {
        const jsonMatch = content.match(/\{"messageId":"[^"]+","delta":"([^"]+)"\}/);
        if (jsonMatch && jsonMatch[1]) {
          content = jsonMatch[1];
        }
      } catch (error) {
        console.error('Failed to parse JSON delta:', error);
      }
    }

    // For assistant messages that are streaming, show loading indicator instead of "Thinking..."
    if (!content || content.trim() === '') {
      if (role === 'assistant') {
        return (
          <div className="flex space-x-1 items-center">
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        );
      }
      return <div className="text-muted italic">Empty message</div>;
    }

    // Check for error patterns that shouldn't be rendered as normal messages
    if (content.includes('[object Object]') ||
        content.includes('TypeError:') ||
        content.includes('ReferenceError:') ||
        content.includes('SyntaxError:') ||
        content.startsWith('Error:')) {

      // Show error as toast instead of message
      addToast({
        type: 'error',
        title: 'Message Error',
        message: 'There was an error processing this message'
      });
      return <div className="text-muted italic">Message processing error</div>;
    }

    // Check if content contains code blocks
    const hasCodeBlocks = content.includes('```');

    if (hasCodeBlocks && role === 'assistant') {
      try {
        return (
          <ReactMarkdown
            components={{
            code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';

              return !inline && language ? (
                <div className="relative">
                  <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg">
                    <span className="text-xs text-gray-300 font-medium">{language}</span>
                    <button
                      onClick={() => handleCopyMessage(String(children))}
                      className="text-xs text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
                    >
                      <FiCopy className="h-3 w-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    PreTag="div"
                    className="rounded-t-none !mt-0"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code
                  className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-accent pl-4 py-1 bg-secondary/30 rounded-r">
                {children}
              </blockquote>
            ),
          }}
          >
            {content}
          </ReactMarkdown>
        );
      } catch (error) {
        console.error('Markdown parsing error:', error);
        addToast({
          type: 'warning',
          title: 'Formatting Error',
          message: 'Could not format message properly'
        });
        // Fallback to plain text
        return (
          <div className="whitespace-pre-wrap text-base sm:text-base leading-relaxed">
            {content}
          </div>
        );
      }
    }

    // Fallback for simple text content
    return (
      <div className="whitespace-pre-wrap text-base sm:text-base leading-relaxed">
        {content}
      </div>
    );
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

  // Render message component for VirtualChatList
  const renderMessage = useCallback((message: any, _index: number, style: React.CSSProperties) => (
    <div style={style}>
      <div
        className={`flex ${
          message.role === 'user'
            ? 'justify-end sm:mr-4 md:mr-8 lg:mr-[230px] 2xl:mr-[485px]'
            : 'justify-start ml-0 sm:ml-4 md:ml-8 lg:ml-[245px] 2xl:ml-[500px]'
        } items-end space-x-2 px-1 sm:px-2 group animate-fade-in`}
      >
        {message.role !== 'user' && (
          <div className="flex-shrink-0 ml-1 sm:ml-0">
            <img
              src={dindinAvatar}
              alt="DINDIN AI"
              className="w-8 h-8 sm:w-8 sm:h-8 rounded-full shadow-md"
            />
          </div>
        )}
        <div className="flex flex-col max-w-[75%] sm:max-w-[65%] md:max-w-[60%] lg:max-w-[55%] 2xl:max-w-[50%] relative">
          {/* Timestamp */}
          <div className={`text-[10px] sm:text-xs mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
            message.role === 'user' ? 'text-right text-muted' : 'text-left text-muted'
          }`}>
            {message.role === 'user'
              ? (() => { const d = new Date(message.timestamp); d.setHours(d.getHours() + 7); return d.toLocaleTimeString(); })()
              : message.timestamp.toLocaleTimeString()}
          </div>

          {/* Message Actions Menu */}
          <div className={`absolute top-0 ${
            message.role === 'user' ? '-left-10' : '-right-10'
          } opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
            <div className="relative">
              <button
                onClick={() => setActiveMessageMenu(activeMessageMenu === message.id ? null : message.id)}
                className="p-1 hover:bg-secondary rounded-lg transition-colors"
                aria-label="Message actions"
              >
                <FiMoreHorizontal className="h-4 w-4 text-muted" />
              </button>

              {/* Actions Dropdown */}
              {activeMessageMenu === message.id && (
                <div className={`absolute top-8 ${
                  message.role === 'user' ? 'right-0' : 'left-0'
                } bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[120px]`}>
                  <button
                    onClick={() => handleCopyMessage(message.content)}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                  >
                    <FiCopy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                  {message.role === 'user' && (
                    <>
                      <button
                        onClick={() => handleEditMessage(message.id, message.content)}
                        className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                      >
                        <FiEdit3 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 transition-colors text-left"
                      >
                        <FiTrash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div
            className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${
              message.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm hover:bg-blue-700'
                : 'card text-primary rounded-bl-sm hover:border-border-hover'
            }`}
          >
            {/* Images */}
            {message.images && message.images.length > 0 && (
              <div className="mb-3">
                <div className={`grid gap-2 sm:gap-3 ${
                  message.images.length === 1 ? 'grid-cols-1' :
                  message.images.length === 2 ? 'grid-cols-2' :
                  'grid-cols-2 md:grid-cols-3'
                }`}>
                  {message.images.map((img: any, idx: number) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.url}
                        alt={`Image ${idx + 1}`}
                        className="rounded-lg w-full h-auto max-h-64 object-cover shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer border border-primary"
                        onClick={() => window.open(img.url, '_blank')}
                        onError={(e) => {
                          console.error('Chat image failed to load:', img.url);
                          addToast({
                            type: 'error',
                            title: 'Image Error',
                            message: `Failed to load image: ${img.url.split('/').pop()}`
                          });
                          e.currentTarget.style.display = 'none';
                        }}
                        loading="lazy"
                        style={{
                          display: 'block',
                          minHeight: '80px',
                          backgroundColor: 'rgb(var(--color-card))'
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {img.mediaType?.split('/')[1]?.toUpperCase() || 'IMG'}
                      </div>
                      <div className="absolute inset-0 bg-secondary rounded-lg animate-pulse opacity-30"
                           style={{ zIndex: -1 }} />
                    </div>
                  ))}
                </div>
                {message.images.length > 1 && (
                  <div className="mt-2 text-xs text-muted">
                    {message.images.length} images attached
                  </div>
                )}
              </div>
            )}

            {/* Message Content */}
            {editingMessage === message.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className={`w-full min-h-[60px] p-2 rounded-lg border resize-none ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white border-blue-400 placeholder-blue-200'
                      : 'bg-card text-primary border-border'
                  }`}
                  placeholder="Edit message..."
                  autoFocus
                />
                <div className="flex space-x-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 text-xs rounded-md hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(message.id)}
                    className="px-3 py-1 text-xs bg-accent text-white rounded-md hover:bg-accent/80 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <React.Suspense fallback={<div className="text-muted">Loading...</div>}>
                  <MessageContent content={message.content} role={message.role} />
                </React.Suspense>
                {message.isStreaming && (
                  <span className="inline-block w-2 sm:w-2 h-5 sm:h-5 bg-current animate-pulse ml-1" />
                )}
              </div>
            )}

            {/* Tool Usage Display */}
            {message.toolUsage && message.toolUsage.length > 0 && (
              <ToolUsageDisplay toolUsage={message.toolUsage} />
            )}
          </div>
        </div>
        {message.role === 'user' && (
          <div className="flex-shrink-0">
            <div className="h-8 w-8 sm:h-8 sm:w-8 bg-gradient-to-br from-[rgb(186,12,47)] to-[rgb(212,175,55)] rounded-full flex items-center justify-center text-white text-sm sm:text-sm font-medium shadow-md">
              {getInitials()}
            </div>
          </div>
        )}
      </div>
    </div>
  ), [activeMessageMenu, editingMessage, editingContent, addToast, handleCopyMessage, handleEditMessage, handleDeleteMessage, handleSaveEdit, handleCancelEdit, getInitials]);

  return (
    <PerformanceMonitor componentName="ChatPage">
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
        {/* Messages with Virtual Scrolling */}
        {hasMessages ? (
          <div className="flex-1 relative">
            <VirtualChatList
              messages={messages || []}
              height={window.innerHeight - 200} // Adjust based on header/input height
              renderMessage={renderMessage}
              autoScroll={true}
              className="px-0 sm:px-4 py-4"
            />

            {/* Typing indicator overlay */}
            {isTyping && (
              <div className="absolute bottom-4 left-4 sm:left-8 md:left-12 lg:left-[245px] 2xl:left-[500px] z-10">
                <div className="flex items-end space-x-2">
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
              </div>
            )}
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
              onFileUpload={handleFileUpload}
              images={images}
              files={files}
              onRemoveImage={handleRemoveImage}
              onRemoveFile={handleRemoveFile}
              disabled={!selectedAgent || isLoading}
              isTyping={isTyping}
              hasMessages={hasMessages}
              isInChatRoom={isInChatRoom}
              onRoomCreated={handleRoomCreatedWithNavigate}
              selectedAgent={selectedAgent}
            />
          </div>
        </div>
        </div>
      </div>
    </PerformanceMonitor>
  );
};

export default ChatPage; 