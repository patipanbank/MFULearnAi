import React, { useRef, useEffect } from 'react';
import { RiImageAddFill, RiFileAddFill, RiCloseLine } from 'react-icons/ri';
import { IoIosArrowDown } from "react-icons/io";
import FileIcon from './FileIcon';
import ModelSelector from './ModelSelector';
import { Model, Usage } from '../utils/types';

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
  handleScrollToBottom: () => void;
  isNearBottom: boolean;
  usage: Usage | null;
  isMobile: boolean;
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
  handleScrollToBottom,
  isNearBottom,
  usage}) => {
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
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      {!isNearBottom && (
        <button
          onClick={handleScrollToBottom}
          className="absolute -top-14 left-1/2 transform -translate-x-1/2 flex items-center space-x-1 bg-white dark:bg-gray-700 px-3 py-1.5 rounded-full shadow-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all z-10"
        >
          <span className="text-xs">New messages</span>
          <IoIosArrowDown className="h-4 w-4" />
        </button>
      )}

      <div className="max-w-3xl mx-auto">
        {/* Selected images preview */}
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedImages.map((image, index) => (
              <div key={index} className="relative">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-md border-2 border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-900">
                  <img 
                    src={URL.createObjectURL(image)} 
                    alt={`Selected ${index}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button 
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white hover:bg-red-600"
                >
                  <RiCloseLine className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="flex items-center space-x-2 p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                  <FileIcon fileName={file.name} />
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-300 truncate max-w-[120px] md:max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button 
                    onClick={() => handleRemoveFile(index)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <RiCloseLine className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Type a message..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-3 pr-14 resize-none overflow-auto text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '150px' }}
              />
              <div className="absolute bottom-0 right-0 p-3 flex space-x-1.5">
                <label htmlFor="image-upload" className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <RiImageAddFill className="h-5 w-5" />
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                <label htmlFor="document-upload" className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <RiFileAddFill className="h-5 w-5" />
                  <input
                    type="file"
                    id="document-upload"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <ModelSelector 
                models={models}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
              />
              
              <button
                type="button"
                onClick={() => setIsImageGenerationMode(!isImageGenerationMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors
                  ${isImageGenerationMode 
                    ? 'border-purple-400 dark:border-purple-500 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' 
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs whitespace-nowrap">
                  {isImageGenerationMode ? 'Image Gen: ON' : 'Image Gen: OFF'}
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!canSubmit()}
              className={`px-4 py-2 rounded-lg text-white font-medium ${canSubmit()
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Thinking...</span>
                </div>
              ) : (
                <span>Send</span>
              )}
            </button>
          </div>

          {/* Usage display */}
          {usage && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-end">
              <span>
                Usage: {usage.dailyTokens.toLocaleString()} / {usage.tokenLimit.toLocaleString()} tokens
                ({usage.remainingTokens < 0 ? 0 : usage.remainingTokens.toLocaleString()} remaining)
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ChatInput;