import { create } from 'zustand';
import { useChatStore } from './chatStore';

export interface UIState {
  isLoading: boolean;
  isMobile: boolean;
  isImageGenerationMode: boolean;
  inputMessage: string;
  awaitingChatId: boolean;
  showSidebar: boolean;
  showModelCard: boolean;
  isThinkMode: boolean;
  mimeType: string | null;
  lastMessageId: string | null;
  activePrompt: string | null;
  scrollToBottom: boolean;
  isProcessingCommand: boolean;
  
  // Actions
  setIsLoading: (isLoading: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  setIsImageGenerationMode: (mode: boolean) => void;
  setInputMessage: (message: string) => void;
  setAwaitingChatId: (awaiting: boolean) => void;
  setShowSidebar: (value: boolean) => void;
  setShowModelCard: (value: boolean) => void;
  setIsThinkMode: (value: boolean) => void;
  setMimeType: (value: string | null) => void;
  setLastMessageId: (value: string | null) => void;
  setActivePrompt: (value: string | null) => void;
  setScrollToBottom: (value: boolean) => void;
  setIsProcessingCommand: (value: boolean) => void;
  
  // Derived actions
  initMobileDetection: () => void;
  toggleSidebar: () => void;
  toggleModelCard: () => void;
  handleScrollToBottom: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // State
  isLoading: false,
  isMobile: window.innerWidth < 768,
  isImageGenerationMode: false,
  inputMessage: '',
  awaitingChatId: false,
  showSidebar: window.innerWidth >= 768,
  showModelCard: false,
  isThinkMode: false,
  mimeType: null,
  lastMessageId: null,
  activePrompt: null,
  scrollToBottom: true,
  isProcessingCommand: false,
  
  // Actions
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setIsImageGenerationMode: (mode) => {
    set({ isImageGenerationMode: mode });
    
    // If turning on image generation, make sure think mode is off
    if (mode && get().isThinkMode) {
      set({ isThinkMode: false });
    }
  },
  setInputMessage: (message) => set({ inputMessage: message }),
  setAwaitingChatId: (awaiting) => set({ awaitingChatId: awaiting }),
  setShowSidebar: (value) => set({ showSidebar: value }),
  setShowModelCard: (value) => set({ showModelCard: value }),
  setIsThinkMode: (value) => {
    set({ isThinkMode: value });
    
    // If turning on think mode, make sure image generation is off
    if (value && get().isImageGenerationMode) {
      set({ isImageGenerationMode: false });
    }
  },
  setMimeType: (value) => set({ mimeType: value }),
  setLastMessageId: (value) => set({ lastMessageId: value }),
  setActivePrompt: (value) => set({ activePrompt: value }),
  setScrollToBottom: (value) => set({ scrollToBottom: value }),
  setIsProcessingCommand: (value) => set({ isProcessingCommand: value }),
  
  // Complex actions
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  toggleModelCard: () => set((state) => ({ showModelCard: !state.showModelCard })),
  handleScrollToBottom: () => {
    // If there's a messagesEndRef, scroll to it
    const messagesEndRef = useChatStore.getState().messagesEndRef;
    if (messagesEndRef?.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  },
  
  // ตรวจสอบขนาดหน้าจอ
  initMobileDetection: () => {
    const checkIfMobile = () => {
      set({ isMobile: window.innerWidth < 768 });
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }
})); 