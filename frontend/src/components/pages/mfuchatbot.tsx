import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import ScrollToBottomButton from '../chat/ui/ScrollToBottomButton';
import { useChatStore } from '../chat/store/chatStore';
import { useModelStore } from '../chat/store/modelStore';
import { useUIStore } from '../chat/store/uiStore';
import { isValidObjectId } from '../chat/utils/formatters';
import useScrollManager from '../../hooks/useScrollManager';

const MFUChatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Using useScrollManager hook for scroll management
  const {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    messageCount: _messageCount,
    setMessageCount,
    handleScrollToBottom
  } = useScrollManager();
  
  // Chat state from Zustand
  const {
    messages,
    currentChatId,
    selectedImages,
    selectedFiles,
    editingMessage,
    currentPage,
    totalPages,
    hasMoreMessages,
    isLoadingMoreMessages,
    setCurrentChatId,
    initWebSocket,
    loadChatHistory,
    loadChatMessagesPaginated,
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    handleCancelGeneration,
    handleEditMessage,
    handleRegenerateMessage,
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
    setIsImageGenerationMode,
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
  
  // Handle loading more messages
  const handleLoadMoreMessages = () => {
    if (hasMoreMessages && !isLoadingMoreMessages) {
      loadChatMessagesPaginated(currentPage + 1);
    }
  };

  // Update message count when messages change
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages, setMessageCount]);
  
  // Initialize WebSocket when component mounts
  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);
  
  // Fetch models when component mounts
  useEffect(() => {
    console.log('Fetching models...');
    fetchModels();
  }, [fetchModels]);
  
  // Only update URL when response is complete - not during streaming
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
    
    // Handle the early URL updates from WebSocket messages
    const handleChatUrlUpdated = (event: CustomEvent) => {
      const { chatId, early } = event.detail || {};
      if (chatId && early && chatId !== currentChatId) {
        console.log('URL updated early for chatId:', chatId);
        setCurrentChatId(chatId);
      }
    };
    
    window.addEventListener('chatUpdated', handleChatUpdated as EventListener);
    window.addEventListener('chatUrlUpdated', handleChatUrlUpdated as EventListener);
    
    return () => {
      window.removeEventListener('chatUpdated', handleChatUpdated as EventListener);
      window.removeEventListener('chatUrlUpdated', handleChatUrlUpdated as EventListener);
    };
  }, [currentChatId, setCurrentChatId, navigate]);
  
  // Load chat history from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');
    
    if (chatId && isValidObjectId(chatId)) {
      console.log('Loading chat history for:', chatId);
      loadChatHistory(chatId);
      setCurrentChatId(chatId);
    } else {
      // Reset chat when navigating to /mfuchatbot without chat ID
      console.log('No valid chat ID found');
      useChatStore.getState().resetChat();
    }
  }, [location.search, loadChatHistory, setCurrentChatId]);
  
  // Fetch usage data when component mounts
  useEffect(() => {
    fetchUsage();
    
    // Update token data when there's a new message or response
    const handleUpdateUsage = () => {
      fetchUsage();
    };
    
    window.addEventListener('chatMessageReceived', handleUpdateUsage);
    window.addEventListener('chatUpdated', handleUpdateUsage);
    
    return () => {
      window.removeEventListener('chatMessageReceived', handleUpdateUsage);
      window.removeEventListener('chatUpdated', handleUpdateUsage);
    };
  }, [fetchUsage]);
  
  return (
    <div className="flex flex-col h-full relative">
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 pb-32 overscroll-contain scroll-smooth"
        ref={chatContainerRef}
        id="chat-messages"
        data-testid="chat-messages-container"
      >
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <div className="space-y-6">
            {/* Load More Messages Button */}
            {hasMoreMessages && (
              <div className="flex justify-center py-2">
                <button
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
                    ${isLoadingMoreMessages 
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                    }`}
                  onClick={handleLoadMoreMessages}
                  disabled={isLoadingMoreMessages}
                >
                  {isLoadingMoreMessages ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span>Load More Messages</span>
                    </div>
                  )}
                </button>
              </div>
            )}
            
            {messages.map((message, index) => {
              // Check if this is the latest assistant message
              const isLastAssistantMessage = (() => {
                // Start searching from the latest message
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].role === 'assistant' && i === index) {
                    return true;
                  } else if (messages[i].role === 'assistant') {
                    return false;
                  }
                }
                return false;
              })();

              return (
                <ChatBubble 
                  key={message.id}
                  message={message}
                  isLastMessage={index === messages.length - 1}
                  isLoading={isLoading}
                  onContinueClick={handleContinueClick}
                  onCancelClick={handleCancelGeneration}
                  onEditClick={handleEditMessage}
                  onRegenerateClick={handleRegenerateMessage}
                  selectedModel={selectedModel}
                  messageIndex={index}
                  isLastAssistantMessage={isLastAssistantMessage}
                />
              );
            })}
            <div 
              ref={messagesEndRef} 
              id="chat-bottom-anchor"
              data-testid="chat-bottom-anchor"
              className="h-2 w-full my-2"
            />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10">
        {/* Show scroll to bottom button when there are messages and user is not at the bottom */}
        {messages.length > 0 && (
          <div className="relative w-full max-w-[95%] lg:max-w-[85%] mx-auto h-0">
            <ScrollToBottomButton 
              isNearBottom={isNearBottom}
              onClick={handleScrollToBottom}
            />
          </div>
        )}
        
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
          usage={usage}
          isMobile={isMobile}
          editingMessage={editingMessage}
          handleCancelGeneration={handleCancelGeneration}
        />
      </div>
      
    </div>
  );
};

export default MFUChatbot;
