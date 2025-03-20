import React, { useRef, useEffect } from 'react';
import { RiImageAddFill, RiFileAddFill, RiCloseLine } from 'react-icons/ri';
import { IoIosArrowDown } from "react-icons/io";
import FileIcon from './FileIcon';
import ModelSelector from './ModelSelector';
import { Model, Usage } from '../utils/types';
import { validateImageFile } from '../utils/fileProcessing';
import { useChatStore } from '../../../store/chatStore';
import { useScrollStore } from '../../../store/scrollStore';
import { useChatActionsStore } from '../../../store/chatActionsStore';

// We keep the props interface for type safety, but we'll use the store directly in the component
interface ChatInputProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  userScrolledManually: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  textareaRef,
  userScrolledManually
}) => {
  // Get state from chat store
  const inputMessage = useChatStore(state => state.inputMessage);
  const setInputMessage = useChatStore(state => state.setInputMessage);
  const selectedImages = useChatStore(state => state.selectedImages);
  const setSelectedImages = useChatStore(state => state.setSelectedImages);
  const selectedFiles = useChatStore(state => state.selectedFiles);
  const setSelectedFiles = useChatStore(state => state.setSelectedFiles);
  const isImageGenerationMode = useChatStore(state => state.isImageGenerationMode);
  const setIsImageGenerationMode = useChatStore(state => state.setIsImageGenerationMode);
  const models = useChatStore(state => state.models);
  const selectedModel = useChatStore(state => state.selectedModel);
  const setSelectedModel = useChatStore(state => state.setSelectedModel);
  const usage = useChatStore(state => state.usage);

  // Get actions from action store
  const handleSubmit = useChatActionsStore(state => state.handleSubmit);
  const handleKeyDown = useChatActionsStore(state => state.handleKeyDown);
  const handlePaste = useChatActionsStore(state => state.handlePaste);
  const canSubmit = useChatActionsStore(state => state.canSubmit);

  // Get scroll state
  const isNearBottom = useScrollStore(state => state.isNearBottom);
  const handleScrollToBottom = useScrollStore(state => state.handleScrollToBottom);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // If it's an image file
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      const docFiles = Array.from(files).filter(file => !file.type.startsWith('image/'));
      
      // Validate and add image files
      for (const file of imageFiles) {
        try {
          validateImageFile(file);
          setSelectedImages(prev => [...prev, file]);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Unknown error occurred');
        }
      }
      
      // Add document files
      if (docFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...docFiles]);
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 300) + 'px';
    }
  };

  // Auto-resize the textarea when the input message changes
  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  // Focus the textarea when the component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const scrollDownButton = !isNearBottom && (
    <button 
      onClick={handleScrollToBottom} 
      className="fixed bottom-32 right-8 bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg z-10 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <IoIosArrowDown className="text-xl" />
    </button>
  );

  return (
    <>
      {scrollDownButton}
      
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        {/* File attachments preview */}
        {(selectedImages.length > 0 || selectedFiles.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedImages.map((image, index) => (
              <div key={index} className="relative group">
                <div className="w-16 h-16 rounded overflow-hidden">
                  <img 
                    src={URL.createObjectURL(image)} 
                    alt={`Attached image ${index}`} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <button 
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <RiCloseLine />
                </button>
              </div>
            ))}
            
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="w-16 h-16 rounded overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                  <FileIcon filename={file.name} type={file.type} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gray-800 bg-opacity-70 text-white text-xs px-1 truncate">
                  {file.name.length > 12 ? `${file.name.substring(0, 10)}...` : file.name}
                </div>
                <button 
                  onClick={() => handleRemoveFile(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <RiCloseLine />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex items-end gap-2">
          <ModelSelector 
            models={models} 
            selectedModel={selectedModel} 
            onSelectModel={setSelectedModel}
            usage={usage}
          />
          
          <div className="relative flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden shadow-sm">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isImageGenerationMode ? "Describe the image you want to generate..." : "Type a message..."}
              className="w-full outline-none resize-none p-3 max-h-[300px] bg-transparent dark:text-white"
              rows={1}
              data-user-scrolled-manually={userScrolledManually}
            />
            
            <div className="flex items-center p-2 border-t border-gray-200 dark:border-gray-600">
              <label className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer">
                <RiImageAddFill className="text-lg" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  multiple
                />
              </label>
              
              <label className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer">
                <RiFileAddFill className="text-lg" />
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  multiple
                />
              </label>
              
              <button
                onClick={(e) => {
                  // Create a custom form event
                  const formEvent = { preventDefault: () => {}, currentTarget: { dataset: { userScrolledManually } } } as any;
                  handleSubmit(formEvent);
                }}
                disabled={!canSubmit()}
                className={`ml-auto rounded-md px-4 py-1 font-medium ${
                  canSubmit() 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isImageGenerationMode ? "Generate" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatInput;