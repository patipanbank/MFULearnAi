import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types/chat.types';
import { ToolUsageDisplay } from '../../../shared/ui/ToolUsageDisplay';
import dindinAvatar from '../../../assets/dindin.png';

interface ChatMessageProps {
  message: ChatMessageType;
  getInitials: () => string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, getInitials }) => {
  return (
    <div
      className={`flex ${
        message.role === 'user' 
          ? 'justify-end sm:mr-4 md:mr-8 lg:mr-[230px] 2xl:mr-[485px]' 
          : 'justify-start ml-0 sm:ml-4 md:ml-8 lg:ml-[245px] 2xl:ml-[500px]'
      } items-end space-x-2 px-1 sm:px-2`}
    >
      {message.role !== 'user' && (
        <div className="flex-shrink-0 ml-1 sm:ml-0">
          <img 
            src={dindinAvatar} 
            alt="DINDIN AI" 
            className="w-8 h-8 sm:w-8 sm:h-8 rounded-full shadow-md"
          />
        </div>
      )}
      
      <div className="flex flex-col max-w-[75%] sm:max-w-[65%] md:max-w-[60%] lg:max-w-[55%] 2xl:max-w-[50%]">
        {/* Timestamp */}
        <div className={`text-[10px] sm:text-xs mb-1 ${
          message.role === 'user' ? 'text-right text-muted' : 'text-left text-muted'
        }`}>
          {message.role === 'user'
            ? (() => { 
                const d = new Date(message.timestamp); 
                d.setHours(d.getHours() + 7); 
                return d.toLocaleTimeString(); 
              })()
            : message.timestamp.toLocaleTimeString()}
        </div>
        
        <div
          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-sm ${
            message.role === 'user'
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'card text-primary rounded-bl-sm'
          }`}
        >
          {/* Images */}
          {message.images && message.images.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:gap-3">
              {message.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img.url}
                  alt="Uploaded"
                  className="rounded-lg max-w-full h-auto shadow-sm"
                />
              ))}
            </div>
          )}
          
          {/* Message Content */}
          <div className="whitespace-pre-wrap text-base sm:text-base">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-2 sm:w-2 h-5 sm:h-5 bg-current animate-pulse ml-1" />
            )}
          </div>
          
          {/* Tool Usage Display */}
          {message.toolUsage && message.toolUsage.length > 0 && (
            <ToolUsageDisplay toolUsage={message.toolUsage} />
          )}
        </div>
      </div>
      
      {message.role === 'user' && (
        <div className="flex-shrink-0">
          <div className="h-8 w-8 sm:h-8 sm:w-8 bg-gradient-to-br from-[rgb(186,12,47)] to-[rgb(212,175,55)] rounded-full flex items-center justify-center text-white text-sm sm:text-sm font-medium shadow-md">
            {getInitials()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;