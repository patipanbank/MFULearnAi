import { create } from 'zustand';
import { MutableRefObject } from 'react';

interface ScrollState {
  // Refs
  messagesEndRef: MutableRefObject<HTMLDivElement | null> | null;
  chatContainerRef: MutableRefObject<HTMLDivElement | null> | null;
  
  // State
  isNearBottom: boolean;
  shouldAutoScroll: boolean;
  userScrolledManually: boolean;
  lastScrollPosition: number;
  messageCount: number;
  
  // Actions
  setMessagesEndRef: (ref: MutableRefObject<HTMLDivElement | null>) => void;
  setChatContainerRef: (ref: MutableRefObject<HTMLDivElement | null>) => void;
  setIsNearBottom: (value: boolean) => void;
  setShouldAutoScroll: (value: boolean) => void;
  setUserScrolledManually: (value: boolean) => void;
  setLastScrollPosition: (value: number) => void;
  setMessageCount: (count: number) => void;
  
  // Functions
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleScrollToBottom: () => void;
  initScrollListener: () => () => void;
  updateMessageCount: (messages: any[]) => void;
}

export const useScrollStore = create<ScrollState>((set, get) => ({
  // Refs
  messagesEndRef: null,
  chatContainerRef: null,
  
  // State
  isNearBottom: true,
  shouldAutoScroll: true,
  userScrolledManually: false,
  lastScrollPosition: 0,
  messageCount: 0,
  
  // Actions
  setMessagesEndRef: (ref) => set({ messagesEndRef: ref }),
  setChatContainerRef: (ref) => set({ chatContainerRef: ref }),
  setIsNearBottom: (value) => set({ isNearBottom: value }),
  setShouldAutoScroll: (value) => set({ shouldAutoScroll: value }),
  setUserScrolledManually: (value) => set({ userScrolledManually: value }),
  setLastScrollPosition: (value) => set({ lastScrollPosition: value }),
  setMessageCount: (count) => set({ messageCount: count }),
  
  // Functions
  scrollToBottom: (behavior = 'smooth') => {
    const { messagesEndRef, shouldAutoScroll } = get();
    if (messagesEndRef && shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  },
  
  handleScrollToBottom: () => {
    set({ 
      shouldAutoScroll: true,
      isNearBottom: true,
      userScrolledManually: false
    });
    
    // Use RAF for smoother animation
    requestAnimationFrame(() => {
      const { messagesEndRef } = get();
      messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
    });
  },
  
  initScrollListener: () => {
    const { chatContainerRef } = get();
    const chatContainer = chatContainerRef?.current;
    
    if (!chatContainer) return () => {};
    
    const handleScroll = () => {
      const { lastScrollPosition } = get();
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      
      // Calculate distance from bottom (in pixels)
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // Consider "near bottom" if within a small threshold (3% of container height)
      const dynamicThreshold = Math.max(10, clientHeight * 0.03);
      const isAtBottom = distanceFromBottom < dynamicThreshold;
      
      // Detect if user is manually scrolling by comparing to last position
      const isManualScrollAction = Math.abs(scrollTop - lastScrollPosition) > 5;
      
      // Update last scroll position
      set({ lastScrollPosition: scrollTop });
      
      // Update UI state for scroll button visibility
      set({ isNearBottom: isAtBottom });
      
      // Any manual scroll action during messages loading should disable auto-scroll
      if (isManualScrollAction && !isAtBottom) {
        set({ 
          userScrolledManually: true,
          shouldAutoScroll: false
        });
      }
      
      // Only re-enable auto-scroll if the user explicitly scrolls to the very bottom
      if (isAtBottom && get().userScrolledManually) {
        set({ 
          userScrolledManually: false,
          shouldAutoScroll: true
        });
      }
    };

    // Use requestAnimationFrame for smoother detection during scrolling
    let ticking = false;
    const scrollListener = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    chatContainer.addEventListener('scroll', scrollListener, { passive: true });
    
    // Cleanup function
    return () => {
      chatContainer.removeEventListener('scroll', scrollListener);
    };
  },
  
  updateMessageCount: (messages) => {
    const { messageCount, shouldAutoScroll, userScrolledManually } = get();
    const newCount = messages.length;
    
    // Update message count
    set({ messageCount: newCount });
    
    // Auto-scroll when new messages arrive if conditions are right
    if (newCount > messageCount && shouldAutoScroll && !userScrolledManually) {
      get().scrollToBottom();
    }
  }
}));

// Hook for using scroll in components
export const useScroll = () => {
  const {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    shouldAutoScroll,
    userScrolledManually,
    setMessagesEndRef,
    setChatContainerRef,
    scrollToBottom,
    handleScrollToBottom,
    initScrollListener,
    updateMessageCount
  } = useScrollStore();
  
  return {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    shouldAutoScroll,
    userScrolledManually,
    setMessagesEndRef,
    setChatContainerRef,
    scrollToBottom,
    handleScrollToBottom,
    initScrollListener,
    updateMessageCount
  };
}; 