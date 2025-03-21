import React from 'react';
import { Usage } from '../utils/types';
import { IoIosStats } from 'react-icons/io';

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
  let textColor = 'text-green-600 dark:text-green-400';
  if (remainingPercentage < 30) {
    barColor = 'bg-red-500';
    textColor = 'text-red-600 dark:text-red-400';
  } else if (remainingPercentage < 60) {
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-600 dark:text-yellow-400';
  }
  
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group relative z-10 shadow-sm">
      <IoIosStats className={`h-4 w-4 ${textColor}`} />
      
      <div className="flex flex-col w-full">
        <span className={`text-xs md:text-sm font-medium ${textColor}`}>
          {usage.remainingTokens.toLocaleString()}/{usage.tokenLimit.toLocaleString()} tokens
        </span>
        
        {/* Progress bar - always show */}
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
          <div 
            className={`h-full ${barColor} rounded-full`} 
            style={{ width: `${usedPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default TokenUsageDisplay; 