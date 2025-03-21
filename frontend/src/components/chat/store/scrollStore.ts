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
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // กำหนด threshold
      const threshold = Math.max(20, clientHeight * 0.05);
      const isAtBottom = distanceFromBottom < threshold;
      
      // ตรวจสอบว่าผู้ใช้กำลังเลื่อนเองหรือไม่ (เคลื่อนไหวมากกว่า 2px)
      const isManualScrolling = Math.abs(scrollTop - lastScrollPosition) > 2;
      
      // อัพเดตสถานะ
      set({ isAtBottom });
      
      // แสดง/ซ่อนปุ่มเลื่อนไปด้านล่าง
      set({ showScrollButton: !isAtBottom });
      
      // ถ้าผู้ใช้กำลังเลื่อนขึ้นและไม่ได้อยู่ที่ด้านล่าง
      if (isManualScrolling && !isAtBottom) {
        set({ 
          isScrollingManually: true,
          autoScrollEnabled: false
        });
      }
      
      // ถ้าผู้ใช้เลื่อนไปถึงด้านล่าง เปิดใช้งาน auto-scroll อีกครั้ง
      if (isAtBottom && get().isScrollingManually) {
        set({
          isScrollingManually: false,
          autoScrollEnabled: true
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
    
    // อัพเดตตำแหน่งเริ่มต้น
    calculateScrollPosition();
    
    // ส่งคืนฟังก์ชัน cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  },
  
  // อัพเดตตำแหน่งการเลื่อนโดยไม่รอ scroll event
  updateScrollPosition: () => {
    const container = get().scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = Math.max(20, clientHeight * 0.05);
    const isAtBottom = distanceFromBottom < threshold;
    
    set({ 
      isAtBottom,
      showScrollButton: !isAtBottom,
      lastScrollPosition: scrollTop,
      lastScrollHeight: scrollHeight,
      lastClientHeight: clientHeight
    });
  },
  
  // จัดการการคลิกปุ่มเลื่อนลงด้านล่าง
  handleScrollButtonClick: () => {
    set({
      autoScrollEnabled: true,
      isScrollingManually: false
    });
    
    // เลื่อนลงทันที
    requestAnimationFrame(() => {
      get().forceScrollToBottom();
    });
  },
  
  // จัดการเมื่อมีข้อความใหม่
  handleNewMessage: () => {
    get().updateScrollPosition();
    
    // ถ้าเปิดใช้งาน auto-scroll
    if (get().autoScrollEnabled) {
      setTimeout(() => {
        get().scrollToBottom();
      }, 50);
    }
  },
  
  // จัดการเมื่อข้อความใหม่เสร็จสมบูรณ์
  handleMessageComplete: () => {
    get().updateScrollPosition();
    
    // ถ้าเปิดใช้งาน auto-scroll
    if (get().autoScrollEnabled) {
      setTimeout(() => {
        get().scrollToBottom();
      }, 50);
    }
  }
})); 