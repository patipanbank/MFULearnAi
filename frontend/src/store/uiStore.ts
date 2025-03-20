import { create } from 'zustand';

interface UIState {
  isLoading: boolean;
  isMobile: boolean;
  isNearBottom: boolean;
  shouldAutoScroll: boolean;
  userScrolledManually: boolean;
  isImageGenerationMode: boolean;
  inputMessage: string;
  
  // Actions
  setIsLoading: (isLoading: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  setIsNearBottom: (isNearBottom: boolean) => void;
  setShouldAutoScroll: (shouldAutoScroll: boolean) => void;
  setUserScrolledManually: (scrolled: boolean) => void;
  setIsImageGenerationMode: (mode: boolean) => void;
  setInputMessage: (message: string) => void;
  
  // Derived actions
  initMobileDetection: () => void;
  handleScrollToBottom: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // State
  isLoading: false,
  isMobile: false,
  isNearBottom: true,
  shouldAutoScroll: true,
  userScrolledManually: false,
  isImageGenerationMode: false,
  inputMessage: '',
  
  // Actions
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setIsNearBottom: (isNearBottom) => set({ isNearBottom }),
  setShouldAutoScroll: (shouldAutoScroll) => set({ shouldAutoScroll }),
  setUserScrolledManually: (scrolled) => set({ userScrolledManually: scrolled }),
  setIsImageGenerationMode: (mode) => set({ isImageGenerationMode: mode }),
  setInputMessage: (message) => set({ inputMessage: message }),
  
  // Derived actions
  initMobileDetection: () => {
    const checkIfMobile = () => {
      set({ isMobile: window.innerWidth < 768 });
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  },
  
  handleScrollToBottom: () => {
    set({ 
      shouldAutoScroll: true,
      isNearBottom: true,
      userScrolledManually: false
    });
    
    // Actual scrolling will be handled in the component using a ref
  }
})); 