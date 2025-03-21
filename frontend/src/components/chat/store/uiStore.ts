import { create } from 'zustand';
import { createRef, MutableRefObject } from 'react';

export interface UIState {
  isLoading: boolean;
  isMobile: boolean;
  isNearBottom: boolean;
  shouldAutoScroll: boolean;
  userScrolledManually: boolean;
  isImageGenerationMode: boolean;
  inputMessage: string;
  awaitingChatId: boolean;
  
  // เพิ่มสถานะจาก useScrollManagement
  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
  chatContainerRef: MutableRefObject<HTMLDivElement | null>;
  lastScrollPosition: number;
  messageCount: number;
  
  // Actions
  setIsLoading: (isLoading: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  setIsNearBottom: (isNearBottom: boolean) => void;
  setShouldAutoScroll: (shouldAutoScroll: boolean) => void;
  setUserScrolledManually: (scrolled: boolean) => void;
  setIsImageGenerationMode: (mode: boolean) => void;
  setInputMessage: (message: string) => void;
  setAwaitingChatId: (awaiting: boolean) => void;
  
  // เพิ่ม Actions จาก useScrollManagement
  setMessageCount: (count: number) => void;
  initScrollListener: () => () => void;
  scrollToBottom: (force?: boolean) => void;
  handleScrollToBottom: () => void;
  updateScrollPosition: () => void;
  
  // Derived actions
  initMobileDetection: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // State
  isLoading: false,
  isMobile: false,
  isNearBottom: true,
  shouldAutoScroll: true,
  userScrolledManually: false,
  isImageGenerationMode: false,
  inputMessage: '',
  awaitingChatId: false,
  
  // สถานะเพิ่มเติมจาก useScrollManagement
  messagesEndRef: createRef<HTMLDivElement>(),
  chatContainerRef: createRef<HTMLDivElement>(),
  lastScrollPosition: 0,
  messageCount: 0,
  
  // Actions
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setIsNearBottom: (isNearBottom) => set({ isNearBottom }),
  setShouldAutoScroll: (shouldAutoScroll) => set({ shouldAutoScroll }),
  setUserScrolledManually: (scrolled) => set({ userScrolledManually: scrolled }),
  setIsImageGenerationMode: (mode) => set({ isImageGenerationMode: mode }),
  setInputMessage: (message) => set({ inputMessage: message }),
  setAwaitingChatId: (awaiting) => set({ awaitingChatId: awaiting }),
  
  // Actions เพิ่มเติมจาก useScrollManagement
  setMessageCount: (count) => set({ messageCount: count }),
  
  // ตรรกะการจัดการ scroll จาก useScrollManagement
  initScrollListener: () => {
    const chatContainer = get().chatContainerRef.current;
    if (!chatContainer) return () => {};

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      
      // คำนวณระยะห่างจากด้านล่าง (ในหน่วยพิกเซล)
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // กำหนด threshold สำหรับการพิจารณาว่า "ใกล้ถึงด้านล่าง" (5% ของความสูงหรืออย่างน้อย 20px)
      const dynamicThreshold = Math.max(20, clientHeight * 0.05);
      const isAtBottom = distanceFromBottom < dynamicThreshold;
      
      // ตรวจจับว่าผู้ใช้กำลังเลื่อนด้วยตนเองโดยเปรียบเทียบกับตำแหน่งล่าสุด
      const lastScrollPosition = get().lastScrollPosition;
      const isManualScrollAction = Math.abs(scrollTop - lastScrollPosition) > 10; // เพิ่มค่า threshold
      
      // อัปเดตตำแหน่งล่าสุด
      set({ lastScrollPosition: scrollTop });
      
      // อัปเดตสถานะ UI สำหรับปุ่มเลื่อนไปด้านล่าง
      set({ isNearBottom: isAtBottom });
      
      // การเลื่อนด้วยตนเองระหว่างการโหลดข้อความควรปิดการเลื่อนอัตโนมัติ
      if (isManualScrollAction && !isAtBottom) {
        set({ userScrolledManually: true });
        if (get().shouldAutoScroll) {
          set({ shouldAutoScroll: false });
        }
      }
      
      // เปิดใช้งานการเลื่อนอัตโนมัติอีกครั้งเมื่อผู้ใช้เลื่อนไปที่ด้านล่างโดยตรง
      if (isAtBottom && get().userScrolledManually) {
        set({ userScrolledManually: false });
        if (!get().shouldAutoScroll) {
          set({ shouldAutoScroll: true });
        }
      }
    };

    // ใช้ requestAnimationFrame เพื่อการตรวจจับที่ราบรื่นขึ้นระหว่างการเลื่อน
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
    
    // เรียกใช้ handleScroll ครั้งแรกเพื่อตั้งค่าสถานะเริ่มต้น
    handleScroll();
    
    // ทำความสะอาด
    return () => {
      chatContainer.removeEventListener('scroll', scrollListener);
    };
  },
  
  // ฟังก์ชันเลื่อนไปด้านล่าง
  scrollToBottom: (force?: boolean) => {
    const { shouldAutoScroll, messagesEndRef } = get();
    const chatContainer = get().chatContainerRef.current;
    
    if (!chatContainer || !messagesEndRef.current) return;
    
    if (shouldAutoScroll || force) {
      try {
        // ใช้ requestAnimationFrame เพื่อให้แน่ใจว่า DOM อัพเดทเรียบร้อยแล้ว
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: force ? 'auto' : 'smooth', 
            block: 'end'
          });
          
          // อัพเดทสถานะเพื่อให้ UI แสดงถูกต้อง
          setTimeout(() => {
            if (chatContainer) {
              const { scrollTop, scrollHeight, clientHeight } = chatContainer;
              const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
              const isAtBottom = distanceFromBottom < 20;
              
              set({ 
                isNearBottom: isAtBottom,
                lastScrollPosition: scrollTop
              });
            }
          }, 100);
        });
      } catch (error) {
        console.error('Error in scrollToBottom:', error);
      }
    }
  },
  
  // จัดการการคลิกปุ่มเลื่อนลงด้านล่าง
  handleScrollToBottom: () => {
    set({ 
      shouldAutoScroll: true,
      isNearBottom: true,
      userScrolledManually: false
    });
    
    // ใช้ requestAnimationFrame เพื่อให้แน่ใจว่า state ได้อัพเดทแล้ว
    requestAnimationFrame(() => {
      // ใช้ behavior: 'auto' แทน 'smooth' เพื่อให้การคลิกปุ่มมีการตอบสนองที่รวดเร็ว
      const { messagesEndRef } = get();
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
      
      // อัพเดทตำแหน่งการ scroll หลังจากเลื่อนไปที่ด้านล่าง
      const chatContainer = get().chatContainerRef.current;
      if (chatContainer) {
        set({ lastScrollPosition: chatContainer.scrollTop });
      }
    });
  },
  
  // ฟังก์ชันตรวจสอบและอัปเดตตำแหน่งการเลื่อน
  updateScrollPosition: () => {
    const chatContainer = get().chatContainerRef.current;
    if (!chatContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const dynamicThreshold = Math.max(10, clientHeight * 0.03);
    const isAtBottom = distanceFromBottom < dynamicThreshold;
    
    set({ isNearBottom: isAtBottom });
  },
  
  // Derived actions
  initMobileDetection: () => {
    const checkIfMobile = () => {
      set({ isMobile: window.innerWidth < 768 });
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }
})); 