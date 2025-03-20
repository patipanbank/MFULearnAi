import React, { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import useChatStore from '../../store/useChatStore';
import useChatWebSocketStore from '../../store/useChatWebSocketStore';
import useChatActionsStore from '../../store/useChatActionsStore';
import { useScrollManagement } from '../../store/useScrollStore';
import { Message } from '../chat/utils/types';

const MFUChatbot: React.FC = () => {
  const location = useLocation();
  
  // Get chat state from Zustand store
  const {
    messages,
    inputMessage,
    setInputMessage,
    isLoading,
    isImageGenerationMode,
    setIsImageGenerationMode,
    isMobile,
    models,
    selectedModel,
    setSelectedModel,
    selectedImages,
    setSelectedImages,
    usage,
    selectedFiles,
    setSelectedFiles,
    fetchUsage,
    fetchModels,
    loadChatHistory,
    checkIfMobile
  } = useChatStore();

  // Initialize WebSocket connection
  const { initializeWebSocket } = useChatWebSocketStore();

  // Get scroll management from hook
  const {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    setShouldAutoScroll,
    handleScrollToBottom,
    userScrolledManually,
  } = useScrollManagement({ messages });

  // Get chat actions from store
  const {
    handleSubmit: originalHandleSubmit,
    handleKeyDown: originalHandleKeyDown,
    handlePaste,
    handleContinueClick: originalHandleContinueClick,
    canSubmit
  } = useChatActionsStore();
  
  // Wrap the action handlers to pass the location
  const handleSubmit = useCallback((e: React.FormEvent) => {
    // Only force auto-scroll if user hasn't manually scrolled
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    return originalHandleSubmit(e, location);
  }, [originalHandleSubmit, location, setShouldAutoScroll, userScrolledManually]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    return originalHandleKeyDown(e, location);
  }, [originalHandleKeyDown, location]);
  
  const handleContinueClick = useCallback((e: React.MouseEvent) => {
    // Only force auto-scroll if user hasn't manually scrolled
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    return originalHandleContinueClick(e, location);
  }, [originalHandleContinueClick, location, setShouldAutoScroll, userScrolledManually]);

  // Auto-scroll effect for streaming messages
  useEffect(() => {
    // If the last message is from assistant and still loading (streaming)
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage && 
      lastMessage.role === 'assistant' && 
      !lastMessage.isComplete && 
      !userScrolledManually
    ) {
      setShouldAutoScroll(true);
    }
  }, [messages, setShouldAutoScroll, userScrolledManually]);

  // Initialize chat on mount
  useEffect(() => {
    // Check if device is mobile
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    // Fetch models
    fetchModels();
    
    // Fetch usage
    fetchUsage();
    
    // Initialize WebSocket
    initializeWebSocket();
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, [checkIfMobile, fetchModels, fetchUsage, initializeWebSocket]);

  // Load chat history when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');
    
    if (chatId) {
      loadChatHistory(chatId);
    }
  }, [location.search, loadChatHistory]);

  return (
    <div className="flex flex-col h-full" ref={chatContainerRef}>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <div className="space-y-6">
            {messages.map((message: Message, index: number) => (
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
        setSelectedImages={setSelectedImages}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
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
