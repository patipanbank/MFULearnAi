import React from 'react';
import { VscDebugContinue } from "react-icons/vsc";
import { Message } from '../utils/types';
import MessageContent from './MessageContent';
import LoadingDots from './LoadingDots';
import { formatMessageTime } from '../utils/formatters';
import { useChatActionsStore } from '../../../store/chatActionsStore';
import { useChatStore } from '../../../store/chatStore';

interface ChatBubbleProps {
  message: Message;
  isLastMessage: boolean;
  isLoading: boolean;
  selectedModel?: string;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isLastMessage, 
  isLoading
}) => {
  // Get selected model from store
  const selectedModel = useChatStore(state => state.selectedModel);
  
  // Get handleContinueClick from actions store
  const handleContinueClick = useChatActionsStore(state => state.handleContinueClick);
  
  return (
    <div className="message relative">
      <div className={`flex items-start gap-3 ${
        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
      }`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ${
          message.role === 'user'
            ? 'bg-gradient-to-r from-red-600 to-yellow-400'
            : 'bg-transparent'
        } flex items-center justify-center`}>
          {message.role === 'user' ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          ) : (
            <img
              src="/dindin.PNG"
              alt="AI Assistant"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        <div className={`flex-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
          <div className={`inline-block p-3 rounded-lg ${
            message.role === 'user' 
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white'
          }`}>
            <MessageContent message={message} selectedModel={selectedModel} />
            
            {isLastMessage && message.role === 'assistant' && isLoading && (
              <div className="mt-2">
                <LoadingDots />
              </div>
            )}
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatMessageTime(message.timestamp)}
            
            {isLastMessage && message.role === 'assistant' && message.isComplete && (
              <button 
                onClick={handleContinueClick}
                className="ml-2 inline-flex items-center text-blue-500 hover:text-blue-700 transition-colors"
              >
                <VscDebugContinue className="mr-1" />
                Continue
              </button>
            )}
          </div>
        </div>
      </div>

      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
        <div className="ml-2 mt-1">
          <button
            onClick={() => {
              const sourceInfo = message.sources?.map(source =>
                `Model: ${source.modelId}\n` +
                `Collection: ${source.collectionName}\n` +
                `File: ${source.filename}\n` +
                `Source: ${source.source || 'N/A'}\n` +
                `Similarity: ${(source.similarity * 100).toFixed(1)}%`
              ).join('\n\n');
              alert(sourceInfo);
            }}
            className="text-xs text-blue-500 hover:text-blue-700 underline flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View Sources ({message.sources.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatBubble; 