import { useChatStateStore } from '../../../store/chatStateStore';
import { useChatInputStore } from '../../../store/chatInputStore';
import { useChatActionsStore } from '../../../store/chatActionsStore';

// This hook is now a wrapper around our Zustand stores
// It maintains backward compatibility with components that use it
export const useChatActions = () => {
  // Get state and actions from our Zustand stores
  const {
    messages,
    selectedModel,
    isLoading,
    isMobile,
    setMessages,
    setIsLoading
  } = useChatStateStore();
  
  const {
    inputMessage,
    selectedImages,
    selectedFiles,
    isImageGenerationMode,
    setInputMessage,
    setSelectedImages,
    setSelectedFiles,
    setIsImageGenerationMode
  } = useChatInputStore();
  
  const {
    wsRef,
    userScrolledManually,
    shouldAutoScroll,
    setUserScrolledManually,
    setShouldAutoScroll,
    handleSubmit,
    handleContinueClick,
    handleKeyDown,
    handlePaste,
    canSubmit
  } = useChatActionsStore();

  // Re-export the actions using the same interface for backward compatibility
  return {
    // Chat state
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    selectedImages,
    setSelectedImages,
    selectedFiles,
    setSelectedFiles,
    isImageGenerationMode,
    setIsImageGenerationMode,
    isLoading,
    setIsLoading,
    wsRef,
    userScrolledManually,
    setUserScrolledManually,
    shouldAutoScroll,
    setShouldAutoScroll, 
    selectedModel,
    isMobile,
    
    // Chat actions
    handleSubmit,
    handleContinueClick,
    handleKeyDown,
    handlePaste,
    canSubmit,
    
    // Methods to maintain compatibility
    addImage: (image: File) => {
      setSelectedImages([...selectedImages, image]);
    },
    removeImage: (index: number) => {
      const newImages = [...selectedImages];
      newImages.splice(index, 1);
      setSelectedImages(newImages);
    },
    addFile: (file: File) => {
      setSelectedFiles([...selectedFiles, file]);
    },
    removeFile: (index: number) => {
      const newFiles = [...selectedFiles];
      newFiles.splice(index, 1);
      setSelectedFiles(newFiles);
    }
  };
}; 