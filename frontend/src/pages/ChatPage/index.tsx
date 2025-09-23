import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import Loading from '../../shared/ui/Loading';
import { api } from '../../shared/lib/api';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useChatNavigation } from '../../shared/hooks/useChatNavigation';
import { useChatInput } from '../../shared/hooks/useChatInput';
import { useMessageActions } from './hooks/useMessageActions';
import { useFileUpload } from './hooks/useFileUpload';
import ChatMessages from './components/ChatMessages';
import WelcomeScreen from './components/WelcomeScreen';
import WorkflowStatus from '../../shared/components/WorkflowStatus';

const ChatPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const currentSession = useChatStore((state) => state.currentSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const isTyping = useChatStore((state) => state.isTyping);
  const setIsTyping = useChatStore((state) => state.setIsTyping);
  const setChatHistory = useChatStore((state) => state.setChatHistory);
  const isLoading = useChatStore((state) => state.isLoading);
  const workflowState = useChatStore((state) => state.workflowState);

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
    sendMessage: wsSendMessage,
    getWorkflowState
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

  // Custom hooks for extracted functionality
  const {
    activeMessageMenu,
    editingMessage,
    editingContent,
    handleCopyMessage,
    handleEditMessage,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteMessage,
    setActiveMessageMenu,
    setEditingContent
  } = useMessageActions();

  const {
    files,
    handleFileUpload,
    handleRemoveFile
  } = useFileUpload();

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

    // Get workflow state if in a chat room
    if (chatId && chatId.length === 24) {
      console.log('Requesting workflow state for:', chatId);
      getWorkflowState(chatId);
    }
  }, [wsRef, isInChatRoom, chatId, currentSession, selectedAgent, pendingQueueRef, pendingFirstRef, getWorkflowState]);

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

    // Clear input immediately (no local message creation)
    const messageToSend = message.trim();
    const imagesToSend = [...images];
    setMessage('');
    setImages([]);

    // Show processing state
    setIsTyping(true);

    // Check if we're in a chat room
    if (isInChatRoom && chatId && chatId.length === 24) {
      console.log('ChatPage: Sending to existing room', chatId);
      // Send to existing room with agent configuration
      wsSendMessage(
        messageToSend,
        imagesToSend,
        selectedAgent?.id,
        selectedAgent?.modelId,
        selectedAgent?.temperature,
        selectedAgent?.maxTokens,
        selectedAgent?.systemPrompt,
        selectedAgent?.enableTools || (selectedAgent?.tools && selectedAgent.tools.length > 0),
        selectedAgent?.tools?.map(tool => tool.name) || []
      );
    } else {
      console.log('ChatPage: Creating new room');
      // Create new room
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Store first message for when room is created
        pendingFirstRef.current = {
          text: messageToSend,
          images: imagesToSend,
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
          text: messageToSend,
          images: imagesToSend,
          agentId: selectedAgent.id
        };
      }
    }
  }, [message, images, selectedAgent, addMessage, setMessage, setImages, isInChatRoom, chatId, wsRef, pendingQueueRef, pendingFirstRef, addToast, connectWebSocket, wsSendMessage]);

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

  // Get user initials for avatar
  const getInitials = useCallback(() => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  }, [user]);

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
          <ChatMessages
            messages={currentSession?.messages || []}
            onCopyMessage={handleCopyMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            editingMessage={editingMessage}
            editingContent={editingContent}
            onEditingContentChange={setEditingContent}
            activeMessageMenu={activeMessageMenu}
            onSetActiveMessageMenu={setActiveMessageMenu}
            getInitials={getInitials}
            messagesEndRef={messagesEndRef}
            isTyping={isTyping}
          />
        ) : (
          <WelcomeScreen userName={user?.firstName} />
        )}

        {/* Input Area - Fixed at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary via-primary to-transparent pt-6">
          <div className="px-4 pb-6">
            {/* Workflow Status - only show if active */}
            {workflowState && (
              <div className="mb-3 px-3 py-2 bg-background/80 backdrop-blur-sm rounded-lg border">
                <WorkflowStatus
                  isActive={workflowState.isActive}
                  currentNode={workflowState.currentNode}
                  workflowEngine={workflowState.workflowEngine}
                  features={workflowState.features}
                />
              </div>
            )}

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
  );
};

export default ChatPage;