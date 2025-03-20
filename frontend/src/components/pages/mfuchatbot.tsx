import React from 'react';
import WelcomeMessage from '../chat/ui/WelcomeMessage';
import ChatBubble from '../chat/ui/ChatBubble';
import ChatInput from '../chat/ui/ChatInput';
import { useChatStore, useChatStoreInitializer } from '../../store/chatStore';
import { useScrollManagement } from '../../store/scrollStore';
import { useChatActions } from '../../store/chatActionsStore';

const MFUChatbot: React.FC = () => {
  // Initialize chat store
  useChatStoreInitializer();
  
  // Get chat state from Zustand store (using selective state to optimize renders)
  const messages = useChatStore(state => state.messages);
  const isLoading = useChatStore(state => state.isLoading);

  // Get scroll management from custom hook
  const {
    messagesEndRef,
    chatContainerRef,
    userScrolledManually,
  } = useScrollManagement(messages);

  // Get chat actions
  const {
    textareaRef
  } = useChatActions();

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
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput 
        textareaRef={textareaRef}
        userScrolledManually={userScrolledManually}
      />
    </div>
  );
};

export default MFUChatbot;
