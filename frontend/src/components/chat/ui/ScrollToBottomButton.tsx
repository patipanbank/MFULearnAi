import React from 'react';
import { FaArrowDown } from 'react-icons/fa';

interface ScrollToBottomButtonProps {
  onClick: () => void;
}

/**
 * Button to scroll down to bottom when user is not at the bottom position
 */
const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 sm:bottom-32 right-4 sm:right-8 z-10 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg 
        hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 
        border border-gray-200 dark:border-gray-700
        text-gray-600 dark:text-gray-300"
      aria-label="Scroll to bottom"
    >
      <FaArrowDown className="w-4 h-4 sm:w-5 sm:h-5" />
    </button>
  );
};

export default ScrollToBottomButton; 