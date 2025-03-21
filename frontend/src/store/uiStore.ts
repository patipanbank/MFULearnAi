import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface UIState {
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

// Selectors for better performance when components need specific state values
export const uiSelectors = {
  getIsLoading: (state: UIState) => state.isLoading,
  getIsMobile: (state: UIState) => state.isMobile,
  getIsNearBottom: (state: UIState) => state.isNearBottom,
  getShouldAutoScroll: (state: UIState) => state.shouldAutoScroll,
  getUserScrolledManually: (state: UIState) => state.userScrolledManually,
  getIsImageGenerationMode: (state: UIState) => state.isImageGenerationMode,
  getInputMessage: (state: UIState) => state.inputMessage
};

// Group related state together in slices
const createScrollSlice = (set: any) => ({
  isNearBottom: true,
  shouldAutoScroll: true,
  userScrolledManually: false,
  
  setIsNearBottom: (isNearBottom: boolean) => 
    set({ isNearBottom }, false, 'setIsNearBottom'),
  setShouldAutoScroll: (shouldAutoScroll: boolean) => 
    set({ shouldAutoScroll }, false, 'setShouldAutoScroll'),
  setUserScrolledManually: (scrolled: boolean) => 
    set({ userScrolledManually: scrolled }, false, 'setUserScrolledManually'),
  
  handleScrollToBottom: () => {
    set({ 
      shouldAutoScroll: true,
      isNearBottom: true,
      userScrolledManually: false
    }, false, 'handleScrollToBottom');
  }
});

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      // Initial state
      isLoading: false,
      isMobile: false,
      inputMessage: '',
      isImageGenerationMode: false,
      
      // Include scroll slice
      ...createScrollSlice(set),
      
      // Basic actions
      setIsLoading: (isLoading) => set({ isLoading }, false, 'setIsLoading'),
      setIsMobile: (isMobile) => set({ isMobile }, false, 'setIsMobile'),
      setIsImageGenerationMode: (mode) => set({ isImageGenerationMode: mode }, false, 'setIsImageGenerationMode'),
      setInputMessage: (message) => set({ inputMessage: message }, false, 'setInputMessage'),
      
      // Derived actions
      initMobileDetection: () => {
        const checkIfMobile = () => {
          set({ isMobile: window.innerWidth < 768 }, false, 'initMobileDetection/resize');
        };
        
        checkIfMobile();
        window.addEventListener('resize', checkIfMobile);
        return () => window.removeEventListener('resize', checkIfMobile);
      }
    }),
    { name: 'ui-store' }
  )
); 