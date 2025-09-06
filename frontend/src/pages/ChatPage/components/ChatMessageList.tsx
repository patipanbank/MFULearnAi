import React from 'react';
import type { MessageDisplayProps } from '../types/chat.types';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';

const ChatMessageList: React.FC<MessageDisplayProps> = ({ 
  messages, 
  isTyping, 
  getInitials, 
  messagesEndRef 
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-0 sm:px-4 py-4 pb-32 space-y-4 h-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          getInitials={getInitials}
        />
      ))}
      
      <TypingIndicator isVisible={isTyping} />
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessageList;