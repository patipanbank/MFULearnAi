import React, { useRef, useEffect } from 'react';
import { RiImageAddFill, RiFileAddFill, RiCloseLine } from 'react-icons/ri';
import { IoIosArrowDown } from "react-icons/io";
import FileIcon from './FileIcon';
import ModelSelector from './ModelSelector';
import { Model, Usage } from '../utils/types';
import { validateImageFile } from '../utils/fileProcessing';

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  selectedImages: File[];
  setSelectedImages: React.Dispatch<React.SetStateAction<File[]>>;
  selectedFiles: File[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  isImageGenerationMode: boolean;
  setIsImageGenerationMode: React.Dispatch<React.SetStateAction<boolean>>;
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
  setSelectedImages,
  selectedFiles,
  setSelectedFiles,
  isImageGenerationMode,
  setIsImageGenerationMode,
  models,
  selectedModel,
  setSelectedModel,
  canSubmit,
  handleScrollToBottom,
  isNearBottom,
  usage,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // ถ้าเป็นไฟล์รูปภาพ
      if (e.target.id === 'image-upload') {
        const validImages = Array.from(files).filter(validateImageFile);
        setSelectedImages(prev => [...prev, ...validImages]);
      } 
      // ถ้าเป็นไฟล์เอกสาร
      else if (e.target.id === 'document-upload') {
        setSelectedFiles(prev => [...prev, ...Array.from(files)]);
      }
    }
    // รีเซ็ต input เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-resize textarea as user types
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

  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
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
                scrollbarColor: 'rgb(209 213 219) transparent'
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
                canSubmit() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canSubmit()}
              data-verify="false"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
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

              <button
                type="button"
                className={`px-3 py-1.5 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 
                  hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${
                    isImageGenerationMode ? 'bg-blue-100 dark:bg-blue-900' : ''
                  }`}
                onClick={() => setIsImageGenerationMode(!isImageGenerationMode)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 hidden md:inline">
                  {isImageGenerationMode ? 'Switch to Chat' : 'Image Generation'}
                </span>
              </button>
            </div>

            {/* Right side - Usage display if available */}
            {usage && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {usage.dailyTokens.toLocaleString()} / {usage.tokenLimit.toLocaleString()} tokens
                <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                  <div 
                    className={`h-full rounded-full ${usage.remainingTokens > 0.3 * usage.tokenLimit ? 'bg-green-500' : 'bg-yellow-500'}`}
                    style={{ width: `${Math.min(100, (usage.dailyTokens / usage.tokenLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedImages.map((image, index) => (
                <div key={index} className="relative">
                  <img 
                    src={URL.createObjectURL(image)} 
                    alt={`Selected image ${index + 1}`} 
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
                  >
                    <RiCloseLine className="h-4 w-4" />
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
                  <FileIcon type={file.type} />
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
      
      {/* Scroll to bottom button */}
      <button
        onClick={handleScrollToBottom}
        className={`fixed bottom-[180px] md:bottom-[120px] right-4 md:right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 md:p-3 shadow-lg transition-all duration-300 z-10 ${
          isNearBottom ? 'opacity-0 pointer-events-none transform translate-y-4' : 'opacity-100 transform translate-y-0'
        }`}
        aria-label="Scroll to latest messages"
      >
        <IoIosArrowDown className="h-4 w-4 md:h-5 md:w-5" />
      </button>
    </div>
  );
};

export default ChatInput;