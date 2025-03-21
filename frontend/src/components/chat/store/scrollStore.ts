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
    const { scrollContainerRef } = get();
    const container = scrollContainerRef.current;
    if (!container) return () => {};
    
    // ฟังก์ชันคำนวณตำแหน่งและอัพเดตสถานะ
    const calculateScrollPosition = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      
      // บันทึกค่าล่าสุด
      const { lastScrollPosition } = get();
      set({ 
        lastScrollPosition: scrollTop,
        lastScrollHeight: scrollHeight,
        lastClientHeight: clientHeight
      });
      
      // คำนวณระยะห่างจากด้านล่าง
      const distanceFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
      
      // กำหนด threshold ที่มากขึ้นเนื่อองจาก padding ด้านล่างและ fixed elements
      const threshold = Math.max(50, clientHeight * 0.1); // เพิ่มเป็น 10% ของความสูงหรือ 50px
      const isAtBottom = distanceFromBottom < threshold;
      
      console.log('[ScrollStore] Position calculated:', { 
        scrollTop, 
        scrollHeight, 
        clientHeight, 
        distanceFromBottom, 
        threshold,
        isAtBottom
      });
      
      // ตรวจสอบว่าผู้ใช้กำลังเลื่อนเองหรือไม่ (เคลื่อนไหวมากกว่า 2px)
      const isManualScrolling = Math.abs(scrollTop - lastScrollPosition) > 2;
      
      // อัพเดตสถานะ
      set({ isAtBottom });
      
      // กำหนดให้แสดงปุ่มเมื่อไม่ได้อยู่ที่ด้านล่าง และกำลังไม่อยู่ในสถานะเพิ่งเริ่มต้น
      const showButton = !isAtBottom;
      set({ showScrollButton: showButton });
      
      // ถ้าผู้ใช้กำลังเลื่อนขึ้นและไม่ได้อยู่ที่ด้านล่าง
      if (isManualScrolling && !isAtBottom) {
        console.log('[ScrollStore] Manual scroll detected!', { scrollTop, lastScrollPosition, distanceFromBottom });
        set({ 
          isScrollingManually: true,
          autoScrollEnabled: false,
          showScrollButton: true
        });
      }
      
      // ถ้าผู้ใช้เลื่อนไปถึงด้านล่าง เปิดใช้งาน auto-scroll อีกครั้ง
      if (isAtBottom && get().isScrollingManually) {
        console.log('[ScrollStore] User scrolled to bottom, re-enabling auto-scroll');
        set({
          isScrollingManually: false,
          autoScrollEnabled: true,
          showScrollButton: false
        });
      }
    };
    
    // ใช้ requestAnimationFrame เพื่อเพิ่มประสิทธิภาพ
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          calculateScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    // เพิ่ม event listener
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // เรียกใช้งานทันทีเพื่อตั้งค่าเริ่มต้น
    calculateScrollPosition();
    
    // ทำ mutation observer เพื่อติดตามการเปลี่ยนแปลงเนื้อหาในแชท
    const contentObserver = new MutationObserver(() => {
      // ตรวจสอบตำแหน่ง scroll หลังจากเนื้อหาเปลี่ยน
      calculateScrollPosition();
    });
    
    // เริ่มสังเกตการณ์การเปลี่ยนแปลงเนื้อหา
    contentObserver.observe(container, { 
      childList: true,
      subtree: true, 
      characterData: true,
      characterDataOldValue: true 
    });
    
    // ส่งคืนฟังก์ชัน cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
      contentObserver.disconnect();
    };
  },
  
  // อัพเดตตำแหน่งการเลื่อนโดยไม่รอ scroll event
  updateScrollPosition: () => {
    const container = get().scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    const threshold = Math.max(50, clientHeight * 0.1); // ใช้ค่าเดียวกับใน calculateScrollPosition
    const isAtBottom = distanceFromBottom < threshold;
    
    console.log('[ScrollStore] Updating scroll position', { 
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromBottom, 
      threshold,
      isAtBottom, 
      showButton: !isAtBottom 
    });
    
    // เมื่อเนื้อหามีการเปลี่ยนแปลง และไม่ได้อยู่ที่ด้านล่าง
    // บังคับให้แสดงปุ่ม scroll to bottom
    const showButton = !isAtBottom;
    
    set({ 
      isAtBottom,
      showScrollButton: showButton,
      lastScrollPosition: scrollTop,
      lastScrollHeight: scrollHeight,
      lastClientHeight: clientHeight
    });
    
    // บังคับแสดงปุ่มเลื่อนลงในกรณีที่เนื้อหามีความสูงมากกว่าพื้นที่แสดงผล
    if (scrollHeight > clientHeight * 1.5) {
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
    // ตรวจสอบตำแหน่ง scroll ก่อน
    get().updateScrollPosition();
    
    // อัพเดตสถานะเมื่อมีข้อความใหม่
    const { isAtBottom, isScrollingManually } = get();
    
    console.log('[ScrollStore] New message received', { 
      autoScrollEnabled: get().autoScrollEnabled,
      isAtBottom,
      isScrollingManually,
      showButton: !isAtBottom
    });
    
    // ตรวจสอบขนาดของเนื้อหา
    const container = get().scrollContainerRef.current;
    if (container) {
      const { scrollHeight, clientHeight } = container;
      
      // บังคับแสดงปุ่มเลื่อนลงเมื่อได้รับข้อความใหม่ ถ้าเนื้อหามีความสูงมากกว่าพื้นที่แสดงผล
      if (scrollHeight > clientHeight * 1.2 && !isAtBottom) {
        console.log('[ScrollStore] Content taller than view on new message, showing button');
        set({ showScrollButton: true });
      }
    }
    
    // แสดงปุ่ม back to bottom ถ้าไม่ได้อยู่ที่ด้านล่าง
    if (!isAtBottom) {
      set({ showScrollButton: true });
    }
    
    // ถ้าเปิดใช้งาน auto-scroll และไม่ได้กำลังเลื่อนด้วยตนเอง
    if (get().autoScrollEnabled && !isScrollingManually) {
      setTimeout(() => {
        get().scrollToBottom();
      }, 50);
    }
  },
  
  // จัดการเมื่อข้อความใหม่เสร็จสมบูรณ์
  handleMessageComplete: () => {
    // ตรวจสอบตำแหน่ง scroll ก่อน
    get().updateScrollPosition();
    
    // อัพเดตสถานะเมื่อข้อความเสร็จสมบูรณ์
    const { isAtBottom, isScrollingManually } = get();
    
    console.log('[ScrollStore] Message completed', { 
      autoScrollEnabled: get().autoScrollEnabled, 
      isAtBottom,
      isScrollingManually
    });
    
    // ตรวจสอบขนาดของเนื้อหา
    const container = get().scrollContainerRef.current;
    if (container) {
      const { scrollHeight, clientHeight } = container;
      
      // บังคับแสดงปุ่มเลื่อนลงเมื่อข้อความเสร็จสมบูรณ์ ถ้าเนื้อหามีความสูงมากกว่าพื้นที่แสดงผล
      if (scrollHeight > clientHeight && !isAtBottom) {
        console.log('[ScrollStore] Content taller than view on message complete, showing button');
        set({ showScrollButton: true });
      }
    }
    
    // แสดงปุ่ม back to bottom ถ้าไม่ได้อยู่ที่ด้านล่าง
    if (!isAtBottom) {
      set({ showScrollButton: true });
    }
    
    // ถ้าเปิดใช้งาน auto-scroll และไม่ได้กำลังเลื่อนด้วยตนเอง
    if (get().autoScrollEnabled && !isScrollingManually) {
      setTimeout(() => {
        get().scrollToBottom();
      }, 50);
    }
  }
})); 