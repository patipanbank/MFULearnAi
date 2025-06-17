import React, { useRef, useEffect } from 'react';
import { RiFileAddFill, RiCloseLine } from 'react-icons/ri';
import { MdEdit } from "react-icons/md";
import FileIcon from './FileIcon';
import ModelSelector from './ModelSelector';
import TokenUsageDisplay from './TokenUsageDisplay';
import { Message, Model, Usage } from '../utils/types';

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  selectedImages: File[];
  selectedFiles: File[];
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: (index: number) => void;
  handleRemoveFile: (index: number) => void;
  isImageGenerationMode: boolean;
  setIsImageGenerationMode: (mode: boolean) => void;
  models: Model[];
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  isLoading: boolean;
  canSubmit: () => boolean;
  usage: Usage | null;
  isMobile: boolean;
  editingMessage?: Message | null;
  handleCancelGeneration?: (e: React.MouseEvent) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputMessage,
  setInputMessage,
  handleSubmit,
  handleKeyDown,
  handlePaste,
  selectedImages,
  selectedFiles,
  handleFileSelect,
  handleRemoveImage,
  handleRemoveFile,
  isImageGenerationMode,
  setIsImageGenerationMode,
  models,
  selectedModel,
  setSelectedModel,
  isLoading,
  canSubmit,
  usage,
  editingMessage,
  handleCancelGeneration
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 24;
      const maxLines = 5;
      const maxHeight = lineHeight * maxLines;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    if (isLoading && handleCancelGeneration) {
      handleCancelGeneration(e);
    } else {
      handleSubmit(e as any);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 py-2 px-4 md:py-4">
      <div className="flex flex-col gap-2 w-full max-w-screen-xl mx-auto">
        {/* Edit mode indicator */}
        {editingMessage && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-800 rounded-md text-sm">
            <MdEdit className="h-4 w-4" />
            <span>Editing message</span>
          </div>
        )}
    
        {/* Message input area */}
        <div className="flex items-end gap-2 w-full">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className="w-full p-2 text-sm md:text-base rounded-2xl border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 
                focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none
                scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 
                scrollbar-track-transparent hover:scrollbar-thumb-gray-400 
                dark:hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgb(209 213 219) transparent',
                minHeight: '44px',
                maxHeight: '100px'
              }}
              placeholder={
                selectedImages.length > 0 
                  ? "Please describe or ask about these images..." 
                  : "Type a message..."
              }
              rows={1}
              autoComplete="off"
              spellCheck="false"
              data-verify="false"
            />
          </div>
          
          <div className="flex-shrink-0 flex items-center gap-2">
            <label htmlFor="file-upload" className="cursor-pointer">
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <RiFileAddFill className="h-6 w-6 text-gray-500 hover:text-blue-500 transition-colors" />
            </label>

            <button
              type={isLoading ? "button" : "submit"}
              onClick={isLoading ? handleButtonClick : undefined}
              className={`p-2 rounded-full transition-colors ${
                isLoading ? 'bg-red-500 hover:bg-red-600 text-white' :
                canSubmit() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
              }`}
              disabled={!isLoading && !canSubmit()}
              data-verify="false"
            >
              {isLoading ? (
                <div className="flex items-center justify-center w-6 h-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* File attachments */}
        {(selectedImages.length > 0 || selectedFiles.length > 0) && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Attached Files ({selectedImages.length + selectedFiles.length})
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Image previews */}
              {selectedImages.map((image, index) => (
                <div key={`img-${index}`} className="relative">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Image ${index + 1}`}
                    className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    <RiCloseLine />
                  </button>
                </div>
              ))}
              
              {/* Document previews */}
              {selectedFiles.map((file, index) => (
                <div key={`file-${index}`} className="relative flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <FileIcon fileName={file.name} />
                  <span className="text-sm truncate max-w-[120px] sm:max-w-[200px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="ml-2 text-red-500 hover:text-red-600"
                  >
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model selector and token usage */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2">
          <div className="w-full sm:w-auto">
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
            />
          </div>
          {usage && (
            <div className="w-full sm:w-auto sm:ml-auto">
              <TokenUsageDisplay usage={usage} />
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default ChatInput;