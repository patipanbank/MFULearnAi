import { useEffect, useRef } from 'react';
import useChatStore from '../../../store/chatStore';

const useScrollManagement = () => {
  const { messages, setUserScrolledManually, shouldAutoScroll, setShouldAutoScroll } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Handle auto-scrolling
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  // Handle scroll events
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom) {
        setUserScrolledManually(false);
        setShouldAutoScroll(true);
      } else {
        setUserScrolledManually(true);
        setShouldAutoScroll(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setUserScrolledManually, setShouldAutoScroll]);

  const handleScrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setUserScrolledManually(false);
      setShouldAutoScroll(true);
    }
  };

  const isNearBottom = () => {
    if (!chatContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  return {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    handleScrollToBottom
  };
};

export default useScrollManagement; 