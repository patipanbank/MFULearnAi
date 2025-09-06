import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import Loading from '../../shared/ui/Loading';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useChatNavigation } from '../../shared/hooks/useChatNavigation';
import { useChatInput } from '../../shared/hooks/useChatInput';

// New components
import ChatBackground from './components/ChatBackground';
import WelcomeScreen from './components/WelcomeScreen';
import ChatMessageList from './components/ChatMessageList';

// New hooks
import { useChatMessages } from './hooks/useChatMessages';
import { useChatUI } from './hooks/useChatUI';
import { useImageUpload } from './hooks/useImageUpload';

const ChatPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  
  const currentSession = useChatStore((state) => state.currentSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const setChatHistory = useChatStore((state) => state.setChatHistory);
  
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
  const { messages, isTyping, getInitials, handleImageUpload: uploadImages } = useChatMessages();
  const { isLoading, messagesEndRef } = useChatUI();
  const { images, addImages, removeImage, clearImages } = useImageUpload();

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
    setMessage
  } = useChatInput();

  // Use images from useImageUpload instead of useChatInput
  const handleImageUploadWrapper = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedImages = await uploadImages(event);
    addImages(uploadedImages);
  }, [uploadImages, addImages]);

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
    clearImages();

    // Check if we're in a chat room
    if (isInChatRoom && chatId && chatId.length === 24) {
      console.log('ChatPage: Sending to existing room', chatId);
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
  }, [message, images, selectedAgent, addMessage, setMessage, clearImages, isInChatRoom, chatId, wsRef, pendingQueueRef, pendingFirstRef, addToast, connectWebSocket, wsSendMessage]);

  // Handle remove image
  const handleRemoveImage = useCallback((index: number) => {
    removeImage(index);
  }, [removeImage]);

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
      <ChatBackground />
      
      {/* Chat Area - Full width */}
      <div className="flex-1 flex flex-col w-full relative h-full overflow-hidden">
        {/* Messages */}
        {hasMessages ? (
          <ChatMessageList 
            messages={messages}
            isTyping={isTyping}
            getInitials={getInitials}
            messagesEndRef={messagesEndRef}
          />
        ) : (
          <WelcomeScreen user={user} />
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
              onImageUpload={handleImageUploadWrapper}
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