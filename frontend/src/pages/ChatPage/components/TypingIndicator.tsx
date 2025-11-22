import React from 'react';
import type { TypingIndicatorProps } from '../types';
import dindinAvatar from '../../../assets/dindin.png';

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="flex justify-start items-start w-full py-3">
      <div className="flex-shrink-0 mt-0.5 pl-4 sm:pl-6 md:pl-72 lg:pl-96 xl:pl-[28rem] 2xl:pl-[32rem] pr-2">
        <img
          src={dindinAvatar}
          alt="DINDIN AI"
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full"
        />
      </div>
      <div className="flex flex-col flex-1 min-w-0 relative items-start text-left max-w-lg">
        <div className="card px-4 py-2 rounded-2xl rounded-bl-sm shadow-sm">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;