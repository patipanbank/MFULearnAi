import React, { useRef } from 'react';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import { useChatState } from '../chat/hooks/useChatState';
import { useScrollManagement } from '../chat/hooks/useScrollManagement';
import { useChatActions } from '../chat/hooks/useChatActions';

const MFUChatbot: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Get chat state from custom hook
  const {
    messages,
    isLoading,
    models,
    selectedModel,
    setSelectedModel,
    shouldAutoScroll,
  } = useChatState();

  // Get scroll management from custom hook
  const {
    scrollToBottom
  } = useScrollManagement({ 
    containerRef: chatContainerRef, 
    messagesEndRef 
  });

  // Get chat actions from custom hook
  const {
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
  } = useChatActions();

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">MFU Chat AI</h1>
          <div className="flex space-x-2">
            {/* Model selector component would go here */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-md text-sm"
            >
              <option value="">Select Model</option>
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          messages.map((message, index) => (
            <ChatBubble
              key={message.id}
              message={message}
              isLastMessage={index === messages.length - 1}
              isLoading={isLoading}
              onContinueClick={handleContinueClick}
              selectedModel={selectedModel}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
        <ChatInput
          handleSubmit={handleSubmit}
          handleKeyDown={handleKeyDown}
          handlePaste={handlePaste}
          models={models}
          handleScrollToBottom={scrollToBottom}
          isNearBottom={shouldAutoScroll}
        />
      </div>
    </div>
  );
}

export default MFUChatbot;
