import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { Message } from '../components/chat/utils/types';

interface ScrollState {
  // State
  isNearBottom: boolean;
  shouldAutoScroll: boolean;
  userScrolledManually: boolean;
  
  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  
  // Actions
  setIsNearBottom: (isNearBottom: boolean) => void;
  setShouldAutoScroll: (shouldAutoScroll: boolean) => void;
  setUserScrolledManually: (userScrolledManually: boolean) => void;
  handleScrollToBottom: () => void;
  
  // Utility functions
  checkIfNearBottom: () => boolean;
}

export const useScrollStore = create<ScrollState>((set, get) => ({
  // State
  isNearBottom: true,
  shouldAutoScroll: true,
  userScrolledManually: false,
  
  // Refs
  messagesEndRef: { current: null },
  chatContainerRef: { current: null },
  
  // Actions
  setIsNearBottom: (isNearBottom) => set({ isNearBottom }),
  setShouldAutoScroll: (shouldAutoScroll) => set({ shouldAutoScroll }),
  setUserScrolledManually: (userScrolledManually) => set({ userScrolledManually }),
  
  handleScrollToBottom: () => {
    const { messagesEndRef } = get();
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    set({ 
      shouldAutoScroll: true,
      userScrolledManually: false 
    });
  },
  
  // Utility functions
  checkIfNearBottom: () => {
    const { chatContainerRef } = get();
    const container = chatContainerRef.current;
    
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom
    const position = container.scrollTop + container.clientHeight;
    const height = container.scrollHeight;
    
    return position > height - threshold;
  }
}));

// React hook for scroll management
export const useScrollManagement = (deps: { messages: Message[] }) => {
  const { messages } = deps;
  const {
    isNearBottom,
    shouldAutoScroll,
    userScrolledManually,
    messagesEndRef,
    chatContainerRef,
    setIsNearBottom,
    setShouldAutoScroll,
    setUserScrolledManually,
    handleScrollToBottom,
    checkIfNearBottom
  } = useScrollStore();
  
  // Initialize refs
  const localMessagesEndRef = useRef<HTMLDivElement>(null);
  const localChatContainerRef = useRef<HTMLDivElement>(null);
  
  // Set refs on mount
  useEffect(() => {
    if (localMessagesEndRef.current) {
      (messagesEndRef as any).current = localMessagesEndRef.current;
    }
    if (localChatContainerRef.current) {
      (chatContainerRef as any).current = localChatContainerRef.current;
    }
  }, [messagesEndRef, chatContainerRef]);
  
  // Auto-scroll to bottom when messages change if shouldAutoScroll is true
  useEffect(() => {
    if (shouldAutoScroll) {
      handleScrollToBottom();
    }
  }, [messages, shouldAutoScroll, handleScrollToBottom]);
  
  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      const isBottom = checkIfNearBottom();
      setIsNearBottom(isBottom);
      
      // If user manually scrolled away from bottom, remember this
      if (!isBottom && !userScrolledManually) {
        setUserScrolledManually(true);
        setShouldAutoScroll(false);
      }
      
      // If user scrolled back to bottom, re-enable auto-scroll
      if (isBottom && userScrolledManually) {
        setUserScrolledManually(false);
        setShouldAutoScroll(true);
      }
    };
    
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [
    chatContainerRef, 
    userScrolledManually, 
    setUserScrolledManually, 
    setShouldAutoScroll, 
    setIsNearBottom,
    checkIfNearBottom
  ]);
  
  return {
    messagesEndRef: localMessagesEndRef,
    chatContainerRef: localChatContainerRef,
    isNearBottom,
    setShouldAutoScroll,
    handleScrollToBottom,
    userScrolledManually
  };
};

export default useScrollStore; 