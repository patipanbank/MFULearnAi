import React from 'react';
import type { ChatBackgroundProps } from '../types/chat.types';

const ChatBackground: React.FC<ChatBackgroundProps> = () => {
  return (
    <div className="absolute inset-0 opacity-5">
      <div 
        className="w-full h-full" 
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(186,12,47) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
};

export default ChatBackground;