import { useRef, useState, useEffect } from 'react';

interface UseScrollManagementProps {
  messages: any[];
}

const useScrollManagement = ({ messages }: UseScrollManagementProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [userScrolledManually, setUserScrolledManually] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  // Monitor message count to detect when new messages are added
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      
      // Calculate distance from bottom (in pixels)
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // Consider "near bottom" if within a very small threshold (3% of container height)
      const dynamicThreshold = Math.max(10, clientHeight * 0.03);
      const isAtBottom = distanceFromBottom < dynamicThreshold;
      
      // Detect if user is manually scrolling by comparing to last position
      const isManualScrollAction = Math.abs(scrollTop - lastScrollPosition) > 5;
      setLastScrollPosition(scrollTop);
      
      // Update UI state for scroll button visibility
      setIsNearBottom(isAtBottom);
      
      // Any manual scroll action during messages loading should disable auto-scroll
      if (isManualScrollAction && !isAtBottom) {
        setUserScrolledManually(true);
        if (shouldAutoScroll) {
          setShouldAutoScroll(false);
        }
      }
      
      // Only re-enable auto-scroll if the user explicitly scrolls to the very bottom
      if (isAtBottom && userScrolledManually) {
        setUserScrolledManually(false);
        if (!shouldAutoScroll) {
          setShouldAutoScroll(true);
        }
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
    
    // Cleanup
    return () => {
      chatContainer.removeEventListener('scroll', scrollListener);
    };
  }, [shouldAutoScroll, lastScrollPosition, userScrolledManually]);

  // Effect for auto-scrolling when new messages arrive
  useEffect(() => {
    // Only auto-scroll in specific cases:
    // 1. Auto-scroll is explicitly enabled
    // 2. User hasn't manually scrolled
    // 3. A new message was just added
    if (shouldAutoScroll && !userScrolledManually) {
      scrollToBottom();
    }
  }, [messages, messageCount, shouldAutoScroll, userScrolledManually]);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    // Force scroll to bottom without checking shouldAutoScroll condition
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  // Function to handle scroll to bottom button click
  const handleScrollToBottom = () => {
    setShouldAutoScroll(true);
    setIsNearBottom(true);
    setUserScrolledManually(false);
    
    // Force immediate scroll - more reliable than relying on state changes
    const scrollToBottomImmediately = () => {
      if (messagesEndRef.current) {
        // Use instant scroll first for reliability
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        
        // Then apply smooth scroll for better UX
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
    };
    
    scrollToBottomImmediately();
  };

  return {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    shouldAutoScroll,
    setShouldAutoScroll,
    scrollToBottom,
    handleScrollToBottom,
    userScrolledManually,
    setUserScrolledManually
  };
};

export default useScrollManagement; 