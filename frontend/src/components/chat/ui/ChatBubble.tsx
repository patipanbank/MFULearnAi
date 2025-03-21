import React, { useState } from 'react';
import { VscDebugContinue } from "react-icons/vsc";
import { MdEdit, MdCancel, MdRefresh, MdClose, MdContentCopy } from "react-icons/md";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleStartEdit = () => {
    setEditedContent(message.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onEditClick && editedContent.trim() !== '') {
      const editedMessage = { ...message, content: editedContent };
      onEditClick(editedMessage);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="message relative">
      {isEditing ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">Edit Message</h3>
              <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700">
                <MdClose className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 flex-grow overflow-auto">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-full min-h-[300px] p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                placeholder="Edit message content..."
              />
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        <div className="ml-11 mt-2 flex flex-wrap gap-3">
          {/* Show cancel button during generation */}
          {!message.isComplete && isLoading && onCancelClick && (
            <button
              type="button"
              onClick={onCancelClick}
              className="text-red-500 hover:text-red-600 active:scale-90 transition-all duration-200"
              title="Cancel generation"
            >
              <MdCancel className="h-5 w-5" />
            </button>
          )}
          
          {/* Show continue, edit, and regenerate buttons once complete */}
          {message.isComplete && (
            <>
              <button
                type="button"
                onClick={onContinueClick}
                className={`transition-all duration-200 active:scale-90 ${
                  selectedModel ? 'text-blue-500 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'
                }`}
                disabled={!selectedModel}
                title="Continue writing"
                data-verify="false"
              >
                <VscDebugContinue className="h-5 w-5" />
              </button>
              
              {onRegenerateClick && (
                <button
                  type="button"
                  onClick={onRegenerateClick}
                  className={`transition-all duration-200 active:scale-90 ${
                    selectedModel ? 'text-green-500 hover:text-green-600' : 'text-gray-300 cursor-not-allowed'
                  }`}
                  disabled={!selectedModel}
                  title="Regenerate response"
                >
                  <MdRefresh className="h-5 w-5" />
                </button>
              )}
              
              {/* Copy to clipboard button */}
              <button
                type="button"
                onClick={handleCopyToClipboard}
                className="text-purple-500 hover:text-purple-600 transition-all duration-200 active:scale-90"
                title={isCopied ? "Copied!" : "Copy to clipboard"}
              >
                <MdContentCopy className={`h-5 w-5 ${isCopied ? 'animate-pulse' : ''}`} />
              </button>
              
              {/* Edit button */}
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-gray-500 hover:text-gray-600 transition-all duration-200 active:scale-90"
                title="Edit response"
              >
                <MdEdit className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Edit button only for user messages */}
      {message.role === 'user' && isLastMessage && onEditClick && (
        <div className="mr-11 mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => handleStartEdit()}
            className="text-gray-500 hover:text-gray-600 transition-all duration-200 active:scale-90"
            title="Edit your message"
          >
            <MdEdit className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatBubble; 