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
      className={`absolute left-1/2 transform -translate-x-1/2 -top-8
                bg-blue-500 hover:bg-blue-600 text-white rounded-full 
                p-2 shadow-lg transition-all duration-300 z-10 ${
                  isNearBottom 
                    ? 'opacity-0 pointer-events-none translate-y-2' 
                    : 'opacity-100 translate-y-0'
                }`}
      aria-label="เลื่อนไปยังข้อความล่าสุด"
    >
      <IoIosArrowDown className="h-4 w-4" />
    </button>
  );
};

export default ScrollToBottomButton; 