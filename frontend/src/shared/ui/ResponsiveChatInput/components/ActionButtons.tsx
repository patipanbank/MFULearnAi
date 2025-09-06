import React from 'react';
import { FiSend, FiPlus } from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import type { ActionButtonsProps } from '../types/input.types';

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onSendMessage,
  onAttachClick,
  disabled = false,
  isTyping = false,
  hasContent,
  currentMode
}) => {
  const getButtonClasses = (variant: 'attach' | 'send') => {
    if (currentMode === 'floating') {
      // Floating mode: minimalist underline style
      return cn(
        'px-3 py-2 border-b-2 border-transparent transition-all duration-300',
        'hover:border-blue-500 focus:border-blue-500 focus:outline-none',
        'text-muted hover:text-primary transform hover:scale-105',
        variant === 'send' && !disabled && hasContent && 'text-blue-600 border-blue-600 scale-105'
      );
    } else {
      // Fixed bottom mode: standard button style
      const baseClasses = 'transition-all duration-200 transform hover:scale-105 active:scale-95';
      return variant === 'send' 
        ? cn('btn-primary px-4 py-2 shadow-md', baseClasses)
        : cn('btn-ghost p-2 hover:bg-primary/10', baseClasses);
    }
  };

  return (
    <div className="flex items-center space-x-1">
      {/* Attach Button */}
      <button
        onClick={onAttachClick}
        className={getButtonClasses('attach')}
        disabled={disabled || isTyping}
        title="Attach images"
      >
        <FiPlus className="h-5 w-5" />
        {currentMode === 'fixbottom' && <span className="sr-only">Attach</span>}
      </button>

      {/* Send Button */}
      <button
        onClick={onSendMessage}
        disabled={disabled || isTyping || !hasContent}
        className={getButtonClasses('send')}
        title={disabled || isTyping ? "Cannot send message" : "Send message"}
      >
        <FiSend className="h-5 w-5" />
        <span className="sr-only">Send</span>
      </button>
    </div>
  );
};

export default ActionButtons;