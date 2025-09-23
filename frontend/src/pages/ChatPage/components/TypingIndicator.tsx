import React from 'react';
import type { TypingIndicatorProps } from '../types';
import dindinAvatar from '../../../assets/dindin.png';

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="flex justify-start items-end space-x-2">
      <div className="flex-shrink-0">
        <img
          src={dindinAvatar}
          alt="DINDIN AI"
          className="w-8 h-8 rounded-full shadow-md opacity-50"
        />
      </div>
      <div className="bubble-hybrid assistant">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;