import { create } from 'zustand';
import { RefObject } from 'react';

interface ScrollState {
  // Refs
  messagesEndRef: RefObject<HTMLDivElement> | null;
  chatContainerRef: RefObject<HTMLDivElement> | null;
  
  // State
  isAtBottom: boolean;
  shouldAutoScroll: boolean;
  
  // Actions
  setMessagesEndRef: (ref: RefObject<HTMLDivElement>) => void;
  setChatContainerRef: (ref: RefObject<HTMLDivElement>) => void;
  setIsAtBottom: (value: boolean) => void;
  setShouldAutoScroll: (value: boolean) => void;
  
  // Functions
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleScroll: () => void;
  disableAutoScroll: () => void;
  enableAutoScroll: () => void;
}

export const useScrollStore = create<ScrollState>((set, get) => ({
  // Initial state
  messagesEndRef: null,
  chatContainerRef: null,
  isAtBottom: true,
  shouldAutoScroll: true,
  
  // Setters
  setMessagesEndRef: (ref) => set({ messagesEndRef: ref }),
  setChatContainerRef: (ref) => set({ chatContainerRef: ref }),
  setIsAtBottom: (value) => set({ isAtBottom: value }),
  setShouldAutoScroll: (value) => set({ shouldAutoScroll: value }),
  
  // Functions
  scrollToBottom: (behavior = 'smooth') => {
    const { messagesEndRef, setShouldAutoScroll, setIsAtBottom } = get();
    
    if (messagesEndRef?.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
      setShouldAutoScroll(true);
      setIsAtBottom(true);
    }
  },
  
  handleScroll: () => {
    const { chatContainerRef, setShouldAutoScroll, setIsAtBottom } = get();
    
    if (!chatContainerRef?.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // ถ้าห่างจากด้านล่างไม่เกิน 100px หรือ 10% ของความสูง container
    const threshold = Math.min(100, clientHeight * 0.1);
    const isNearBottom = distanceFromBottom <= threshold;
    
    setIsAtBottom(isNearBottom);
    
    // หากผู้ใช้เลื่อนขึ้น (ห่างจากด้านล่างมาก) ให้ยกเลิก auto scroll
    if (!isNearBottom) {
      setShouldAutoScroll(false);
    }
    
    // หากผู้ใช้เลื่อนกลับลงมาที่ด้านล่าง ให้เปิด auto scroll
    if (isNearBottom && distanceFromBottom < 5) {
      setShouldAutoScroll(true);
    }
  },
  
  disableAutoScroll: () => set({ shouldAutoScroll: false }),
  
  enableAutoScroll: () => {
    set({ shouldAutoScroll: true });
    get().scrollToBottom();
  }
})); 