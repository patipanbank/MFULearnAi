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
    
    if (!container || !bottomElement) {
      console.error('[ScrollStore] Cannot initialize observer: missing container or bottom element', {
        hasContainer: !!container,
        hasBottomElement: !!bottomElement,
        containerId: container?.id,
        bottomId: bottomElement?.id
      });
      return () => {};
    }
    
    console.log('[ScrollStore] Initializing IntersectionObserver', {
      containerId: container.id || 'no-id',
      containerClass: container.className,
      bottomElementId: bottomElement.id || 'no-id',
      bottomElementClass: bottomElement.className
    });
    
    // สร้าง IntersectionObserver เพื่อติดตามองค์ประกอบด้านล่าง
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;
        const prevIsAtBottom = get().isAtBottom;
        
        console.log('[ScrollStore] Bottom visibility changed:', { 
          isVisible,
          prevIsAtBottom,
          intersectionRatio: entries[0].intersectionRatio,
          boundingClientRect: entries[0].boundingClientRect
        });
        
        if (isVisible) {
          // เมื่อองค์ประกอบด้านล่างมองเห็น = อยู่ที่ด้านล่าง
          set({
            isAtBottom: true,
            isScrollingManually: false,
            autoScrollEnabled: true,
            showScrollButton: false // ซ่อนปุ่มเมื่ออยู่ด้านล่าง
          });
        } else {
          // เมื่อองค์ประกอบด้านล่างไม่มองเห็น = ไม่ได้อยู่ที่ด้านล่าง
          set({
            isAtBottom: false,
            isScrollingManually: true,
            autoScrollEnabled: false,
            showScrollButton: true // แสดงปุ่มเมื่อไม่ได้อยู่ด้านล่าง
          });
        }
      },
      {
        root: container,
        threshold: 0.3, // เพิ่มจาก 0.1 เป็น 0.3 = ต้องเห็น 30% ขององค์ประกอบถึงจะถือว่าอยู่ด้านล่าง
        rootMargin: '20px' // ลดจาก 100px เป็น 20px เพื่อให้ต้องอยู่ใกล้ด้านล่างจริงๆ
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
    const distanceFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    
    // บันทึกค่าล่าสุด
    set({
      lastScrollPosition: scrollTop,
      lastScrollHeight: scrollHeight,
      lastClientHeight: clientHeight
    });
    
    // ใช้ค่า isAtBottom จาก IntersectionObserver (ไม่ต้องคำนวณซ้ำ)
    const isAtBottom = get().isAtBottom;
    
    console.log('[ScrollStore] Updating scroll position', { 
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromBottom,
      isAtBottom
    });
    
    // เงื่อนไขการแสดงปุ่มที่เรียบง่าย:
    // - ถ้าไม่ได้อยู่ด้านล่าง = แสดงปุ่ม
    // - ถ้าอยู่ด้านล่าง = ซ่อนปุ่ม
    if (!isAtBottom) {
      set({ showScrollButton: true });
    } else {
      set({ showScrollButton: false });
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
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    const isAtBottom = get().isAtBottom;
    
    console.log('[ScrollStore] New message received', { 
      autoScrollEnabled: get().autoScrollEnabled,
      isAtBottom,
      distanceFromBottom,
      isScrollingManually: get().isScrollingManually
    });
    
    // เงื่อนไขการแสดงปุ่มที่เรียบง่าย:
    // - ถ้าไม่ได้อยู่ด้านล่าง = แสดงปุ่ม
    if (!isAtBottom) {
      set({ showScrollButton: true });
    } else {
      set({ showScrollButton: false });
    }
    
    // ถ้าเปิดใช้งาน auto-scroll และไม่ได้กำลังเลื่อนด้วยตนเอง
    if (get().autoScrollEnabled && !get().isScrollingManually) {
      console.log('[ScrollStore] Auto-scrolling to bottom');
      requestAnimationFrame(() => {
        get().scrollToBottom();
      });
    }
  },
  
  // จัดการเมื่อข้อความใหม่เสร็จสมบูรณ์
  handleMessageComplete: () => {
    // ตรวจสอบขนาดของเนื้อหา
    const container = get().scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    const isAtBottom = get().isAtBottom;
    
    console.log('[ScrollStore] Message completed', { 
      autoScrollEnabled: get().autoScrollEnabled, 
      isAtBottom,
      distanceFromBottom,
      isScrollingManually: get().isScrollingManually
    });
    
    // เงื่อนไขการแสดงปุ่มที่เรียบง่าย:
    // - ถ้าไม่ได้อยู่ด้านล่าง = แสดงปุ่ม
    if (!isAtBottom) {
      set({ showScrollButton: true });
    } else {
      set({ showScrollButton: false });
    }
    
    // ถ้า auto-scroll เปิดอยู่ และไม่ได้กำลังเลื่อนด้วยตนเอง ให้เลื่อนลงด้านล่าง
    if (get().autoScrollEnabled && !get().isScrollingManually) {
      console.log('[ScrollStore] Auto-scrolling after message complete');
      // ใช้ requestAnimationFrame เพื่อให้เลื่อนหลัง DOM อัพเดต
      requestAnimationFrame(() => {
        get().scrollToBottom();
      });
    }
  }
})); 