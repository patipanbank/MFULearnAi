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
    <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
      {/* Scroll to bottom button - improved visibility based on scroll distance */}
      {!isNearBottom && (
        <button
          onClick={handleScrollToBottom}
          className="fixed bottom-[180px] md:bottom-[120px] right-4 md:right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 md:p-3 shadow-lg transition-all duration-300 z-10"
          aria-label="Scroll to latest messages"
        >
          <IoIosArrowDown className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      )}

      <form onSubmit={handleSubmit} className="p-2 md:p-4">
        <div className="flex flex-col gap-2 max-w-[95%] lg:max-w-[85%] mx-auto">
          {/* Message input area */}
          <div className="flex gap-2 w-full">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className="flex-1 min-w-0 p-2 text-sm md:text-base rounded-2xl border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 
                focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none
                scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 
                scrollbar-track-transparent hover:scrollbar-thumb-gray-400 
                dark:hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgb(209 213 219) transparent',
                minHeight: '44px',
                maxHeight: '150px'
              }}
              placeholder={
                isImageGenerationMode 
                  ? "Describe the image you want to generate..." 
                  : selectedImages.length > 0 
                    ? "Please describe or ask about these images..." 
                    : "Type a message..."
              }
              rows={1}
              autoComplete="off"
              spellCheck="false"
              data-verify="false"
            />
            
            <button
              type="submit"
              className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                canSubmit() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canSubmit()}
              data-verify="false"
            >
              {isLoading ? (
                <div className="flex items-center justify-center w-6 h-6">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>

          {/* Controls and options */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {/* Left side controls */}
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

              {!isImageGenerationMode && (
                <>
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="px-3 py-1.5 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 
                      hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                    onClick={() => {
                      document.getElementById('image-upload')?.click();
                    }}
                  >
                    <RiImageAddFill className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 hidden md:inline">Add Image</span>
                  </button>
                  
                  <input
                    type="file"
                    id="document-upload"
                    accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.ppt,.pptx"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="px-3 py-1.5 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 
                      hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                    onClick={() => {
                      document.getElementById('document-upload')?.click();
                    }}
                  >
                    <RiFileAddFill className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 hidden md:inline">Add File</span>
                  </button>
                </>
              )}

              {usage && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4z" />
                  </svg>
                  <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                    {usage.remainingTokens}/{usage.tokenLimit} tokens
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedImages.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Selected ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative flex items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <FileIcon fileName={file.name} />
                  <span className="ml-2 text-xs truncate max-w-[150px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="ml-2 p-1 text-red-500 hover:text-red-700 rounded-full"
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ChatInput;