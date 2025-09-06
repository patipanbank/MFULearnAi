import React from 'react';
import { cn } from '../../../lib/utils';
import type { ChatTextAreaProps } from '../types/input.types';
import { useInputResize } from '../hooks/useInputResize';

const ChatTextArea: React.FC<ChatTextAreaProps> = ({
  message,
  onMessageChange,
  onKeyPress,
  disabled = false,
  isTyping = false,
  currentMode
}) => {
  const { textareaRef, handleTextareaChange } = useInputResize();

  const getInputClasses = () => {
    return cn(
      'w-full resize-none border-none bg-transparent',
      'focus:outline-none focus:ring-0',
      'placeholder-muted text-primary',
      'text-base leading-relaxed transition-all duration-300',
      currentMode === 'floating' ? 'text-lg py-2' : 'text-base py-1'
    );
  };

  return (
    <div className="flex-1">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => handleTextareaChange(e, onMessageChange)}
        onKeyPress={onKeyPress}
        placeholder={
          currentMode === 'floating' 
            ? 'Ask me anything...' 
            : 'Type your message...'
        }
        className={getInputClasses()}
        rows={1}
        disabled={disabled || isTyping}
      />
    </div>
  );
};

export default ChatTextArea;