import React, { useEffect } from 'react';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import useChatState from '../chat/hooks/useChatState';
import useScrollManagement from '../chat/hooks/useScrollManagement';
import useChatWebSocket from '../chat/hooks/useChatWebSocket';
import useChatActions from '../chat/hooks/useChatActions';
import LoadingDots from '../chat/ui/LoadingDots';

const MFUChatbot: React.FC = () => {
  // Get chat state from custom hook
  const {
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    isLoading,
    setIsLoading,
    isImageGenerationMode,
    setIsImageGenerationMode,
    currentChatId,
    setCurrentChatId,
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
    createNewChat,
    isInitialLoad
  } = useChatState();

  // Get scroll management from custom hook
  const {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    setShouldAutoScroll,
    handleScrollToBottom,
    userScrolledManually,
  } = useScrollManagement({ messages });

  // Get WebSocket connection from custom hook
  const wsRef = useChatWebSocket({
    currentChatId,
    setMessages,
    setCurrentChatId,
    fetchUsage,
    userScrolledManually,
    setShouldAutoScroll
  });

  // Get chat actions from custom hook
  const {
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    canSubmit
  } = useChatActions({
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    selectedImages,
    setSelectedImages,
    selectedFiles,
    setSelectedFiles,
    selectedModel,
    isImageGenerationMode,
    currentChatId,
    wsRef,
    setIsLoading,
    isMobile,
    userScrolledManually,
    setShouldAutoScroll,
    fetchUsage
  });
  
  // Automatically scroll to bottom when starting a new chat
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        handleScrollToBottom();
      }, 100);
    }
  }, [messages.length, handleScrollToBottom]);

  return (
    <div className="flex flex-col h-full" ref={chatContainerRef}>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {isInitialLoad ? (
          <div className="flex justify-center items-center h-full">
            <LoadingDots />
          </div>
        ) : messages.length === 0 ? (
          <WelcomeMessage onNewChat={createNewChat} />
        ) : (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <ChatBubble 
                key={`${message.id}-${index}`}
                message={message}
                isLastMessage={index === messages.length - 1}
                isLoading={isLoading && index === messages.length - 1 && message.role === 'assistant'}
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
