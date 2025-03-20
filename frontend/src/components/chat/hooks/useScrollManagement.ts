import { useEffect, useRef } from 'react';
import { useChatActionsStore } from '../../../store/chatActionsStore';
import { useChatStateStore } from '../../../store/chatStateStore';

interface UseScrollManagementProps {
  containerRef: React.RefObject<HTMLElement>;
  messagesEndRef: React.RefObject<HTMLElement>;
}

export const useScrollManagement = ({ containerRef, messagesEndRef }: UseScrollManagementProps) => {
  const prevMsgLengthRef = useRef<number>(0);
  
  const {
    messages
  } = useChatStateStore();
  
  const {
    userScrolledManually,
    shouldAutoScroll,
    setUserScrolledManually,
    setShouldAutoScroll
  } = useChatActionsStore();

  // Handle scrolling logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      
      // If user scrolled away from bottom
      if (!isAtBottom && shouldAutoScroll) {
        setUserScrolledManually(true);
        setShouldAutoScroll(false);
      }
      
      // If user scrolled back to bottom
      if (isAtBottom && userScrolledManually) {
        setUserScrolledManually(false);
        setShouldAutoScroll(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, userScrolledManually, shouldAutoScroll, setUserScrolledManually, setShouldAutoScroll]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const messagesLength = messages.length;
    
    // Check if new message was added
    if (messagesLength > prevMsgLengthRef.current) {
      // Auto-scroll only if user didn't manually scroll up
      if (shouldAutoScroll && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
    prevMsgLengthRef.current = messagesLength;
  }, [messages, shouldAutoScroll, messagesEndRef]);

  // Function to manually scroll to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setShouldAutoScroll(true);
      setUserScrolledManually(false);
    }
  };

  return {
    scrollToBottom,
    userScrolledManually,
    shouldAutoScroll
  };
}; 