import { useChatStateStore } from '../../../store/chatStateStore';
import { useChatInputStore } from '../../../store/chatInputStore';
import { useChatActionsStore } from '../../../store/chatActionsStore';

// This hook is now a wrapper around our Zustand stores to maintain backward compatibility
export const useChatState = () => {
  // Get state and actions from our Zustand stores
  const {
    messages,
    models,
    selectedModel,
    currentChatId,
    isLoading,
    isMobile,
    fetchModels,
    fetchUsage,
    resetState,
    setMessages,
    setIsLoading,
    setSelectedModel,
    setCurrentChatId
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
    userScrolledManually,
    shouldAutoScroll,
    setUserScrolledManually,
    setShouldAutoScroll
  } = useChatActionsStore();

  // Re-export the state and actions using the same interface for backward compatibility
  return {
    // State
    messages,
    inputMessage,
    selectedImages,
    selectedFiles,
    isImageGenerationMode,
    selectedModel,
    currentChatId,
    models,
    isLoading,
    isMobile,
    userScrolledManually,
    shouldAutoScroll,
    
    // Actions
    setMessages,
    setInputMessage,
    setSelectedImages,
    setSelectedFiles,
    setIsImageGenerationMode,
    setSelectedModel,
    setCurrentChatId,
    setIsLoading,
    setUserScrolledManually,
    setShouldAutoScroll,
    fetchModels,
    fetchUsage,
    resetState
  };
};