import React from 'react';
import { Usage } from '../utils/types';

interface TokenUsageDisplayProps {
  usage: Usage | null;
}

const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ usage }) => {
  if (!usage) return null;
  
  // คำนวณเปอร์เซ็นต์ของ token ที่ใช้ไปแล้ว
  const usedPercentage = Math.min(100, Math.max(0, (usage.dailyTokens / usage.tokenLimit) * 100));
  const remainingPercentage = 100 - usedPercentage;
  
  // กำหนดสีตามเปอร์เซ็นต์ที่เหลือ
  let barColor = 'bg-green-500';
  if (remainingPercentage < 30) {
    barColor = 'bg-red-500';
  } else if (remainingPercentage < 60) {
    barColor = 'bg-yellow-500';
  }
  
  return (
    <div className="relative flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group">  
      
      <div className="flex flex-col w-full">
        {/* Bar แสดงอยู่ตลอดเวลา */}
        <div className="text-xs md:text-sm text-gray-700 dark:text-gray-300 hidden md:inline">Token Usage </div>
        <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1 mt-0.5 border border-gray-300 dark:border-gray-600 md:min-w-[120px]">       
          <div 
            className={`h-full ${barColor} rounded-full transition-all duration-300 ease-in-out min-w-[15px]`} 
            style={{ width: `${Math.max(10, usedPercentage)}%` }}
          />
        </div>
        
        {/* Tooltip แสดงตัวเลขเมื่อ hover */}
        <div className="absolute left-1/2 bottom-full -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
            {usage.dailyTokens.toLocaleString()}/{usage.tokenLimit.toLocaleString()} tokens
            <div className="text-[10px] text-gray-300">Remaining: {usage.remainingTokens.toLocaleString()} tokens</div>
          </div>
          <div className="border-t-4 border-l-4 border-r-4 border-transparent border-t-gray-800 w-0 h-0 absolute left-1/2 top-full -translate-x-1/2"></div>
        </div>
      </div>
    </div>
  );
};

export default TokenUsageDisplay; 