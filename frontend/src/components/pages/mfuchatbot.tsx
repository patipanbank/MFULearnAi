import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import useScrollManagement from '../chat/hooks/useScrollManagement';
import { useChatStore, ChatState } from '../../store/chatStore';
import { useModelStore, ModelState } from '../../store/modelStore';
import { useUIStore, UIState } from '../../store/uiStore';

// Create selectors for optimized rendering
const selectMessages = (state: ChatState) => state.messages;
const selectCurrentChatId = (state: ChatState) => state.currentChatId;
const selectSelectedImages = (state: ChatState) => state.selectedImages;
const selectSelectedFiles = (state: ChatState) => state.selectedFiles;
const selectCanSubmit = (state: ChatState) => state.canSubmit();

const selectIsLoading = (state: UIState) => state.isLoading;
const selectIsImageGenerationMode = (state: UIState) => state.isImageGenerationMode;
const selectIsMobile = (state: UIState) => state.isMobile;
const selectInputMessage = (state: UIState) => state.inputMessage;

const selectModels = (state: ModelState) => state.models;
const selectSelectedModel = (state: ModelState) => state.selectedModel;
const selectUsage = (state: ModelState) => state.usage;

const MFUChatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Chat state from Zustand
  const {
    messages,
    currentChatId,
    selectedImages,
    selectedFiles,
    setMessagesEndRef,
    setChatContainerRef,
    setCurrentChatId,
    initWebSocket,
    loadChatHistory,
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    handleFileSelect,
    handleRemoveImage,
    handleRemoveFile,
    canSubmit,
    sendFirstMessage
  } = useChatStore();
  
  // UI state from Zustand
  const {
    isLoading,
    isImageGenerationMode,
    isMobile,
    inputMessage,
    setInputMessage,
    setIsImageGenerationMode
  } = useUIStore();
  
  // Model state from Zustand
  const {
    models,
    selectedModel,
    usage,
    setSelectedModel,
    fetchUsage,
    fetchModels
  } = useModelStore();
  
  // Scrolling management
  const {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    handleScrollToBottom,
  } = useScrollManagement({ messages });
  
  // Set refs in the chat store
  useEffect(() => {
    setMessagesEndRef(messagesEndRef);
    setChatContainerRef(chatContainerRef);
  }, [messagesEndRef, chatContainerRef, setMessagesEndRef, setChatContainerRef]);
  
  // Initialize WebSocket when component mounts
  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);
  
  // Fetch models when component mounts
  useEffect(() => {
    console.log('Fetching models...');
    fetchModels();
  }, [fetchModels]);
  
  // Debug selectedModel value when it changes
  useEffect(() => {
    console.log('Selected model:', selectedModel);
    console.log('Available models:', models);
  }, [selectedModel, models]);
  
  // Only update URL when response is complete - not during streaming
  // Don't update URL immediately when currentChatId changes
  useEffect(() => {
    const handleChatUpdated = (event: CustomEvent) => {
      const { chatId, complete } = event.detail || {};
      // Only update URL when response is complete
      if (chatId && complete) {
        navigate(`/mfuchatbot?chat=${chatId}`, { replace: true });
      } else if (chatId && chatId !== currentChatId) {
        // Just update the internal state without navigation
        setCurrentChatId(chatId);
      }
    };
    
    window.addEventListener('chatUpdated', handleChatUpdated as EventListener);
    return () => {
      window.removeEventListener('chatUpdated', handleChatUpdated as EventListener);
    };
  }, [currentChatId, setCurrentChatId, navigate]);
  
  // Listen for new chat created event
  useEffect(() => {
    const handleNewChatCreated = (event: CustomEvent) => {
      const { chatId } = event.detail || {};
      if (chatId) {
        navigate(`/mfuchatbot?chat=${chatId}`, { replace: true });
      }
    };
    
    window.addEventListener('newChatCreated', handleNewChatCreated as EventListener);
    return () => {
      window.removeEventListener('newChatCreated', handleNewChatCreated as EventListener);
    };
  }, [navigate]);
  
  // Load chat history from URL params and handle first message sending after navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');
    
    if (chatId) {
      if (chatId === currentChatId && messages.length === 1 && messages[0].role === 'user') {
        // This is the case where we've just navigated after creating a new chat with the first message
        // Now we need to send the first message
        sendFirstMessage(chatId);
      } else {
        // Normal case - load existing chat history
        loadChatHistory(chatId);
      }
    } else {
      // Reset chat when navigating to /mfuchatbot without chat ID
      useChatStore.getState().resetChat();
    }
  }, [location.search, loadChatHistory, currentChatId, messages]);
  
  // Fetch usage data when component mounts
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);
  
  // Update chatStore inputMessage when UIStore inputMessage changes
  useEffect(() => {
    useChatStore.getState().setInputMessage(inputMessage);
  }, [inputMessage]);
  
  return (
    <div className="flex flex-col h-full" ref={chatContainerRef}>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <ChatBubble 
                key={message.id}
                message={message}
                isLastMessage={index === messages.length - 1}
                isLoading={isLoading}
                onContinueClick={handleContinueClick}
                selectedModel={selectedModel}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        handleSubmit={handleSubmit}
        handleKeyDown={handleKeyDown}
        handlePaste={handlePaste}
        selectedImages={selectedImages}
        selectedFiles={selectedFiles}
        handleFileSelect={handleFileSelect}
        handleRemoveImage={handleRemoveImage}
        handleRemoveFile={handleRemoveFile}
        isImageGenerationMode={isImageGenerationMode}
        setIsImageGenerationMode={setIsImageGenerationMode}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        isLoading={isLoading}
        canSubmit={canSubmit}
        handleScrollToBottom={handleScrollToBottom}
        isNearBottom={isNearBottom}
        usage={usage}
        isMobile={isMobile}
      />
    </div>
  );
};

export default MFUChatbot;
