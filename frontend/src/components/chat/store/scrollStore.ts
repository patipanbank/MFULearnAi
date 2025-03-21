import { create } from 'zustand';
import { MutableRefObject } from 'react';

interface ScrollState {
  // สถานะหลัก
  isAtBottom: boolean; // อยู่ที่ด้านล่างหรือไม่
  isScrollingManually: boolean; // กำลังเลื่อนด้วยตนเองหรือไม่
  autoScrollEnabled: boolean; // เปิดใช้งานการเลื่อนอัตโนมัติหรือไม่
  showScrollButton: boolean; // แสดงปุ่มเลื่อนไปด้านล่างหรือไม่
  
  // Refs
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  scrollEndRef: MutableRefObject<HTMLDivElement | null>;
  
  // ข้อมูลติดตาม
  lastScrollPosition: number;
  lastScrollHeight: number;
  lastClientHeight: number;
  bottomObserver: IntersectionObserver | null;
  
  // Actions - เซ็ตเตอร์พื้นฐาน
  setIsAtBottom: (value: boolean) => void;
  setIsScrollingManually: (value: boolean) => void;
  setAutoScrollEnabled: (value: boolean) => void;
  setShowScrollButton: (value: boolean) => void;
  setScrollRefs: (container: MutableRefObject<HTMLDivElement | null>, end: MutableRefObject<HTMLDivElement | null>) => void;
  
  // Actions - ฟังก์ชันหลัก
  scrollToBottom: () => void;
  forceScrollToBottom: () => void;
  initScrollObserver: () => () => void;
  updateScrollPosition: () => void;
  
  // Actions - ฟังก์ชันสาธารณะ
  handleScrollButtonClick: () => void;
  handleNewMessage: () => void;
  handleMessageComplete: () => void;
}

export const useScrollStore = create<ScrollState>((set, get) => ({
  // สถานะเริ่มต้น
  isAtBottom: true,
  isScrollingManually: false,
  autoScrollEnabled: true,
  showScrollButton: false,
  
  // Refs
  scrollContainerRef: { current: null },
  scrollEndRef: { current: null },
  
  // ค่าติดตาม
  lastScrollPosition: 0,
  lastScrollHeight: 0,
  lastClientHeight: 0,
  bottomObserver: null,
  
  // เซ็ตเตอร์พื้นฐาน
  setIsAtBottom: (value) => set({ isAtBottom: value }),
  setIsScrollingManually: (value) => set({ isScrollingManually: value }),
  setAutoScrollEnabled: (value) => set({ autoScrollEnabled: value }),
  setShowScrollButton: (value) => set({ showScrollButton: value }),
  setScrollRefs: (container, end) => set({ 
    scrollContainerRef: container, 
    scrollEndRef: end 
  }),
  
  // ฟังก์ชันเลื่อนไปที่ด้านล่าง (ปกติ - เคารพการตั้งค่า autoScroll)
  scrollToBottom: () => {
    const { autoScrollEnabled, scrollEndRef, isScrollingManually } = get();
    
    // เลื่อนเฉพาะเมื่อเปิดใช้งาน auto-scroll และไม่ได้กำลังเลื่อนเอง
    if (autoScrollEnabled && !isScrollingManually && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  },
  
  // ฟังก์ชันบังคับเลื่อนไปที่ด้านล่าง (ไม่สนใจการตั้งค่า autoScroll)
  forceScrollToBottom: () => {
    const { scrollEndRef } = get();
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  },
  
  // ฟังก์ชันติดตามการเลื่อน
  initScrollObserver: () => {
    const { scrollContainerRef, scrollEndRef } = get();
    const container = scrollContainerRef.current;
    const bottomElement = scrollEndRef.current;
    
    if (!container || !bottomElement) return () => {};
    
    // สร้าง IntersectionObserver เพื่อติดตามองค์ประกอบด้านล่าง
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;
        const prevIsAtBottom = get().isAtBottom;
        
        console.log('[ScrollStore] Bottom visibility changed:', { 
          isVisible,
          prevIsAtBottom
        });
        
        if (isVisible) {
          // เมื่อองค์ประกอบด้านล่างมองเห็น = อยู่ที่ด้านล่าง
          set({
            isAtBottom: true,
            isScrollingManually: false,
            autoScrollEnabled: true,
            showScrollButton: false
          });
        } else {
          // เมื่อองค์ประกอบด้านล่างไม่มองเห็น = ไม่ได้อยู่ที่ด้านล่าง
          set({
            isAtBottom: false,
            isScrollingManually: true,
            autoScrollEnabled: false,
            showScrollButton: true
          });
        }
      },
      {
        root: container,
        threshold: 0.1, // 10% ขององค์ประกอบต้องมองเห็น
        rootMargin: '100px' // เพิ่มขอบเขตการตรวจจับ
      }
    );
    
    // เริ่มสังเกตการณ์องค์ประกอบด้านล่าง
    observer.observe(bottomElement);
    set({ bottomObserver: observer });
    
    // ยังคงใช้ MutationObserver เพื่อติดตามการเปลี่ยนแปลงเนื้อหา
    const contentObserver = new MutationObserver(() => {
      // ตรวจสอบขนาดของเนื้อหาและอัพเดตการแสดงปุ่ม
      const { scrollHeight, clientHeight } = container;
      
      if (scrollHeight > clientHeight * 1.2 && !get().isAtBottom) {
        console.log('[ScrollStore] Content height changed and not at bottom');
        set({ showScrollButton: true });
      }
    });
    
    // เริ่มสังเกตการณ์การเปลี่ยนแปลงเนื้อหา
    contentObserver.observe(container, { 
      childList: true,
      subtree: true, 
      characterData: true,
      characterDataOldValue: true 
    });
    
    // ใช้ scroll event เพื่อบันทึกตำแหน่งล่าสุด (ยังจำเป็นสำหรับฟังก์ชันอื่นๆ)
    const handleScroll = () => {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      
      set({
        lastScrollPosition: scrollTop,
        lastScrollHeight: scrollHeight,
        lastClientHeight: clientHeight
      });
    };
    
    // เพิ่ม event listener และเรียกใช้งานทันที
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    // ส่งคืนฟังก์ชัน cleanup
    return () => {
      observer.disconnect();
      contentObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
      set({ bottomObserver: null });
    };
  },
  
  // อัพเดตตำแหน่งการเลื่อนโดยไม่รอ scroll event
  updateScrollPosition: () => {
    const container = get().scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // บันทึกค่าล่าสุด
    set({
      lastScrollPosition: scrollTop,
      lastScrollHeight: scrollHeight,
      lastClientHeight: clientHeight
    });
    
    // ใช้ค่า isAtBottom จาก IntersectionObserver (ไม่ต้องคำนวณซ้ำ)
    const isAtBottom = get().isAtBottom;
    const showButton = !isAtBottom;
    
    console.log('[ScrollStore] Updating scroll position', { 
      scrollTop,
      scrollHeight,
      clientHeight,
      isAtBottom,
      showButton
    });
    
    // บังคับแสดงปุ่มเลื่อนลงในกรณีที่เนื้อหามีความสูงมากกว่าพื้นที่แสดงผล
    if (scrollHeight > clientHeight * 1.2 && !isAtBottom) {
      console.log('[ScrollStore] Content height exceeds view, forcing button to show');
      set({ showScrollButton: true });
    }
  },
  
  // จัดการการคลิกปุ่มเลื่อนลงด้านล่าง
  handleScrollButtonClick: () => {
    console.log('[ScrollStore] Scroll button clicked');
    set({
      autoScrollEnabled: true,
      isScrollingManually: false,
      showScrollButton: false
    });
    
    // เลื่อนลงทันที
    requestAnimationFrame(() => {
      get().forceScrollToBottom();
    });
  },
  
  // จัดการเมื่อมีข้อความใหม่
  handleNewMessage: () => {
    // ตรวจสอบขนาดของเนื้อหา
    const container = get().scrollContainerRef.current;
    if (!container) return;
    
    const { scrollHeight, clientHeight } = container;
    const isAtBottom = get().isAtBottom;
    
    console.log('[ScrollStore] New message received', { 
      autoScrollEnabled: get().autoScrollEnabled,
      isAtBottom,
      isScrollingManually: get().isScrollingManually,
      showButton: !isAtBottom
    });
    
    // บังคับแสดงปุ่มเลื่อนลงเมื่อได้รับข้อความใหม่ ถ้าเนื้อหามีความสูงมากกว่าพื้นที่แสดงผล
    if (scrollHeight > clientHeight * 1.2 && !isAtBottom) {
      console.log('[ScrollStore] Content taller than view on new message, showing button');
      set({ showScrollButton: true });
    }
    
    // ถ้าเปิดใช้งาน auto-scroll และไม่ได้กำลังเลื่อนด้วยตนเอง
    if (get().autoScrollEnabled && !get().isScrollingManually) {
      setTimeout(() => {
        get().scrollToBottom();
      }, 50);
    }
  },
  
  // จัดการเมื่อข้อความใหม่เสร็จสมบูรณ์
  handleMessageComplete: () => {
    // ตรวจสอบขนาดของเนื้อหา
    const container = get().scrollContainerRef.current;
    if (!container) return;
    
    const { scrollHeight, clientHeight } = container;
    const isAtBottom = get().isAtBottom;
    
    console.log('[ScrollStore] Message completed', { 
      autoScrollEnabled: get().autoScrollEnabled, 
      isAtBottom,
      isScrollingManually: get().isScrollingManually
    });
    
    // บังคับแสดงปุ่มเลื่อนลงเมื่อข้อความเสร็จสมบูรณ์ ถ้าเนื้อหามีความสูงมากกว่าพื้นที่แสดงผล
    if (scrollHeight > clientHeight && !isAtBottom) {
      console.log('[ScrollStore] Content taller than view on message complete, showing button');
      set({ showScrollButton: true });
    }
    
    // ถ้าเปิดใช้งาน auto-scroll และไม่ได้กำลังเลื่อนด้วยตนเอง
    if (get().autoScrollEnabled && !get().isScrollingManually) {
      setTimeout(() => {
        get().scrollToBottom();
      }, 50);
    }
  }
})); 