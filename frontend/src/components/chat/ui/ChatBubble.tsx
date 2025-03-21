import React from 'react';
import { VscDebugContinue } from "react-icons/vsc";
import { MdEdit, MdCancel, MdRefresh } from "react-icons/md";
import { Message } from '../utils/types';
import MessageContent from './MessageContent';
import LoadingDots from './LoadingDots';
import { formatMessageTime } from '../utils/formatters';

interface ChatBubbleProps {
  message: Message;
  isLastMessage: boolean;
  isLoading: boolean;
  onContinueClick: (e: React.MouseEvent) => void;
  onCancelClick?: (e: React.MouseEvent) => void;
  onEditClick?: (message: Message) => void;
  onRegenerateClick?: (e: React.MouseEvent) => void;
  selectedModel: string;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isLastMessage, 
  isLoading, 
  onContinueClick, 
  onCancelClick,
  onEditClick,
  onRegenerateClick,
  selectedModel 
}) => {
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

        <div className={`flex flex-col space-y-2 max-w-[80%] ${
          message.role === 'user' ? 'items-end' : 'items-start'
        }`}>
          <div className="text-sm text-gray-500">
            {formatMessageTime(message.timestamp)}
          </div>
          <div className={`rounded-lg p-3 ${
            message.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 dark:text-white'
          }`}>
            {message.role === 'assistant' && message.content === '' && isLoading ? (
              <LoadingDots />
            ) : (
              <MessageContent message={message} />
            )}
          </div>
        </div>
      </div>

      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
        <div className="ml-11 mt-1">
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

      {/* Action buttons for assistant messages */}
      {message.role === 'assistant' && isLastMessage && (
        <div className="ml-11 mt-2 flex flex-wrap gap-2">
          {/* Show cancel button during generation */}
          {!message.isComplete && isLoading && onCancelClick && (
            <button
              type="button"
              onClick={onCancelClick}
              className="px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-sm bg-red-500 hover:bg-red-600 text-white"
              title="Cancel generation"
            >
              <MdCancel className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          )}
          
          {/* Show continue, edit, and regenerate buttons once complete */}
          {message.isComplete && (
            <>
              <button
                type="button"
                onClick={onContinueClick}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-sm ${
                  selectedModel ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!selectedModel}
                title="Continue writing"
                data-verify="false"
              >
                <VscDebugContinue className="h-4 w-4" />
                <span>Continue</span>
              </button>
              
              {onRegenerateClick && (
                <button
                  type="button"
                  onClick={onRegenerateClick}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-sm ${
                    selectedModel ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!selectedModel}
                  title="Regenerate response"
                >
                  <MdRefresh className="h-4 w-4" />
                  <span>Regenerate</span>
                </button>
              )}
            </>
          )}
          
          {/* Edit button for both complete and incomplete messages */}
          {onEditClick && (
            <button
              type="button"
              onClick={() => onEditClick(message)}
              className="px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white"
              title="Edit message"
            >
              <MdEdit className="h-4 w-4" />
              <span>Edit</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatBubble; 