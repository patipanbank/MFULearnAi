import { create } from 'zustand';
import { Usage } from '../components/chat/utils/types';
import { validateImageFile } from '../components/chat/utils/fileProcessing';

interface ChatInputState {
  inputMessage: string;
  selectedImages: File[];
  selectedFiles: File[];
  isImageGenerationMode: boolean;
  selectedModel: string;
  isLoading: boolean;
  usage: Usage | null;
  isMobile: boolean;
  
  // Actions
  setInputMessage: (message: string) => void;
  setSelectedImages: (images: File[]) => void;
  setSelectedFiles: (files: File[]) => void;
  setIsImageGenerationMode: (mode: boolean) => void;
  setSelectedModel: (modelId: string) => void;
  setIsLoading: (loading: boolean) => void;
  setUsage: (usage: Usage | null) => void;
  setIsMobile: (isMobile: boolean) => void;
  
  // File handling
  addImages: (files: File[]) => void;
  addFiles: (files: File[]) => void;
  removeImage: (index: number) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  
  // Validation
  canSubmit: () => boolean;
}

export const useChatInputStore = create<ChatInputState>((set, get) => ({
  inputMessage: '',
  selectedImages: [],
  selectedFiles: [],
  isImageGenerationMode: false,
  selectedModel: '',
  isLoading: false,
  usage: null,
  isMobile: false,

  // Setters
  setInputMessage: (message) => set({ inputMessage: message }),
  setSelectedImages: (images) => set({ selectedImages: images }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  setIsImageGenerationMode: (mode) => set({ isImageGenerationMode: mode }),
  setSelectedModel: (modelId) => set({ selectedModel: modelId }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setUsage: (usage) => set({ usage }),
  setIsMobile: (isMobile) => set({ isMobile }),

  // File handling
  addImages: (files) => {
    const validImages = files.filter(validateImageFile);
    set(state => ({ 
      selectedImages: [...state.selectedImages, ...validImages] 
    }));
  },

  addFiles: (files) => {
    set(state => ({ 
      selectedFiles: [...state.selectedFiles, ...files] 
    }));
  },

  removeImage: (index) => {
    set(state => ({
      selectedImages: state.selectedImages.filter((_, i) => i !== index)
    }));
  },

  removeFile: (index) => {
    set(state => ({
      selectedFiles: state.selectedFiles.filter((_, i) => i !== index)
    }));
  },

  clearFiles: () => {
    set({ selectedImages: [], selectedFiles: [] });
  },

  // Validation
  canSubmit: () => {
    const { inputMessage, selectedImages, selectedFiles, isImageGenerationMode } = get();
    if (isImageGenerationMode) {
      return inputMessage.trim().length > 0;
    }
    return inputMessage.trim().length > 0 || selectedImages.length > 0 || selectedFiles.length > 0;
  }
})); 