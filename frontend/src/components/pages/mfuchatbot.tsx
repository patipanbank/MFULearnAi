import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import useScrollManagement from '../chat/hooks/useScrollManagement';
import { useChatStore } from '../../store/chatStore';
import { useModelStore } from '../../store/modelStore';
import { useUIStore } from '../../store/uiStore';

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
    canSubmit
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
    fetchModels();
  }, [fetchModels]);
  
  // Update URL when currentChatId changes
  useEffect(() => {
    if (currentChatId) {
      navigate(`/mfuchatbot?chat=${currentChatId}`, { replace: true });
    }
  }, [currentChatId, navigate]);
  
  // Load chat history from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');
    
    if (chatId) {
      loadChatHistory(chatId);
    }
  }, [location.search, loadChatHistory]);
  
  // Listen for chat updates
  useEffect(() => {
    const handleChatUpdated = (event: CustomEvent) => {
      const { chatId } = event.detail || {};
      if (chatId && chatId !== currentChatId) {
        setCurrentChatId(chatId);
      }
    };
    
    window.addEventListener('chatUpdated', handleChatUpdated as EventListener);
    return () => {
      window.removeEventListener('chatUpdated', handleChatUpdated as EventListener);
    };
  }, [currentChatId, setCurrentChatId]);
  
  // Fetch usage data when component mounts
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);
  
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
