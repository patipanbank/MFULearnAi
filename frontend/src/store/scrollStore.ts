import { create } from 'zustand';
import { useRef, useEffect } from 'react';
import { Message } from '../components/chat/utils/types';

interface ScrollState {
  shouldAutoScroll: boolean;
  userScrolledManually: boolean;
  isNearBottom: boolean;
  setShouldAutoScroll: (shouldScroll: boolean) => void;
  setUserScrolledManually: (scrolled: boolean) => void;
  setIsNearBottom: (isNear: boolean) => void;
  handleScrollToBottom: () => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  shouldAutoScroll: true,
  userScrolledManually: false,
  isNearBottom: true,
  setShouldAutoScroll: (shouldScroll) => set({ shouldAutoScroll: shouldScroll }),
  setUserScrolledManually: (scrolled) => set({ userScrolledManually: scrolled }),
  setIsNearBottom: (isNear) => set({ isNearBottom: isNear }),
  handleScrollToBottom: () => set({ shouldAutoScroll: true, userScrolledManually: false })
}));

// Custom hook for scroll management
export const useScrollManagement = (messages: Message[]) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const {
    shouldAutoScroll,
    userScrolledManually,
    isNearBottom,
    setShouldAutoScroll,
    setUserScrolledManually,
    setIsNearBottom,
    handleScrollToBottom
  } = useScrollStore();

  // Scroll to bottom when messages change or shouldAutoScroll is true
  useEffect(() => {
    const scrollToBottomNow = () => {
      if (messagesEndRef.current && shouldAutoScroll) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };
    
    scrollToBottomNow();
    
    // Also scroll when last message gets updated (streaming response)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isComplete) {
      scrollToBottomNow();
    }
  }, [messages, shouldAutoScroll]);

  // Monitor scroll position to detect manual scrolling
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;
      
      // Consider "near bottom" if within 100px of the bottom
      const isNearBottomNow = scrollBottom < 100;
      setIsNearBottom(isNearBottomNow);
      
      // If user scrolls up significantly, mark as manually scrolled
      if (scrollBottom > 200 && !userScrolledManually) {
        setUserScrolledManually(true);
        setShouldAutoScroll(false);
      }
      
      // If user scrolls back to bottom, re-enable auto scroll
      if (isNearBottomNow && userScrolledManually) {
        setUserScrolledManually(false);
        setShouldAutoScroll(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [userScrolledManually, setUserScrolledManually, setShouldAutoScroll, setIsNearBottom]);

  return {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    setShouldAutoScroll,
    handleScrollToBottom,
    userScrolledManually,
  };
}; 