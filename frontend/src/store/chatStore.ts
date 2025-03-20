import { create } from 'zustand';
import { Message, Model, Usage } from '../components/chat/utils/types';

interface ChatState {
  messages: Message[];
  inputMessage: string;
  isLoading: boolean;
  isImageGenerationMode: boolean;
  currentChatId: string | null;
  isMobile: boolean;
  models: Model[];
  selectedModel: string;
  selectedImages: File[];
  selectedFiles: File[];
  usage: Usage | null;
  userScrolledManually: boolean;
  shouldAutoScroll: boolean;
  wsRef: WebSocket | null;
  isLoadingChat: boolean;

  // Actions
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setInputMessage: (message: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsImageGenerationMode: (mode: boolean) => void;
  setCurrentChatId: (id: string | null) => void;
  setIsMobile: (isMobile: boolean) => void;
  setModels: (models: Model[]) => void;
  setSelectedModel: (model: string) => void;
  setSelectedImages: (images: File[]) => void;
  setSelectedFiles: (files: File[]) => void;
  setUsage: (usage: Usage | null) => void;
  setUserScrolledManually: (scrolled: boolean) => void;
  setShouldAutoScroll: (should: boolean) => void;
  setWsRef: (ws: WebSocket | null) => void;
  setIsLoadingChat: (isLoading: boolean) => void;
  
  // Helper actions
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  clearChat: () => void;
}

const useChatStore = create<ChatState>((set) => ({
  // Initial state
  messages: [],
  inputMessage: '',
  isLoading: false,
  isImageGenerationMode: false,
  currentChatId: null,
  isMobile: false,
  models: [],
  selectedModel: '',
  selectedImages: [],
  selectedFiles: [],
  usage: null,
  userScrolledManually: false,
  shouldAutoScroll: true,
  wsRef: null,
  isLoadingChat: false,

  // Basic setters
  setMessages: (messages) => set((state) => ({
    messages: typeof messages === 'function' ? messages(state.messages) : messages
  })),
  setInputMessage: (message) => set({ inputMessage: message }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsImageGenerationMode: (mode) => set({ isImageGenerationMode: mode }),
  setCurrentChatId: (id) => set({ currentChatId: id }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setModels: (models) => set({ models }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedImages: (images) => set({ selectedImages: images }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  setUsage: (usage) => set({ usage }),
  setUserScrolledManually: (scrolled) => set({ userScrolledManually: scrolled }),
  setShouldAutoScroll: (should) => set({ shouldAutoScroll: should }),
  setWsRef: (ws) => set({ wsRef: ws }),
  setIsLoadingChat: (isLoading) => set({ isLoadingChat: isLoading }),

  // Helper actions
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateLastMessage: (content) => set((state) => ({
    messages: state.messages.map((msg, idx) => 
      idx === state.messages.length - 1 
        ? { ...msg, content }
        : msg
    )
  })),

  clearChat: () => set({
    messages: [],
    inputMessage: '',
    currentChatId: null,
    selectedImages: [],
    selectedFiles: [],
  }),
}));

export default useChatStore; 