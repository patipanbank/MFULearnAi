import { useRef, useEffect } from 'react';
import { useScrollStore } from '../../../store/scrollStore';

interface UseScrollWithStoreProps {
  messages: any[];
}

const useScrollWithStore = ({ messages }: UseScrollWithStoreProps) => {
  // สร้าง ref สำหรับ DOM elements
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // ดึง state และ functions จาก scroll store
  const {
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

  // เก็บ refs ลงใน store
  useEffect(() => {
    if (messagesEndRef.current) {
      setMessagesEndRef(messagesEndRef);
    }
    
    if (chatContainerRef.current) {
      setChatContainerRef(chatContainerRef);
    }
  }, [setMessagesEndRef, setChatContainerRef]);

  // ตั้งค่า scroll listener เมื่อ component mount
  useEffect(() => {
    const cleanup = initScrollListener();
    return cleanup;
  }, [initScrollListener]);

  // อัพเดท message count เมื่อมีข้อความใหม่และ scroll to bottom หากเข้าเงื่อนไข
  useEffect(() => {
    updateMessageCount(messages);
  }, [messages, updateMessageCount]);

  return {
    messagesEndRef,
    chatContainerRef,
    isNearBottom,
    shouldAutoScroll,
    userScrolledManually,
    scrollToBottom,
    handleScrollToBottom
  };
};

export default useScrollWithStore; 