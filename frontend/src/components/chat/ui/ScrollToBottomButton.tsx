import React from 'react';
import { IoIosArrowDown } from "react-icons/io";

interface ScrollToBottomButtonProps {
  isNearBottom: boolean;
  onClick: () => void;
}

/**
 * ปุ่มเลื่อนลงด้านล่างที่แสดงเมื่อผู้ใช้ไม่ได้อยู่ที่ตำแหน่งล่างสุด
 */
const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({ isNearBottom, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-[180px] md:bottom-[120px] right-4 md:right-6 
                bg-blue-500 hover:bg-blue-600 text-white rounded-full 
                p-2 md:p-3 shadow-lg transition-all duration-300 z-10 ${
                  isNearBottom 
                    ? 'opacity-0 pointer-events-none transform translate-y-4' 
                    : 'opacity-100 transform translate-y-0'
                }`}
      aria-label="เลื่อนไปยังข้อความล่าสุด"
    >
      <IoIosArrowDown className="h-4 w-4 md:h-5 md:w-5" />
    </button>
  );
};

export default ScrollToBottomButton; 