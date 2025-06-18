import React, { useRef } from 'react';
import { FiSend, FiPlus, FiX } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import useLayoutStore from '../../stores/layoutStore';

interface ResponsiveChatInputProps {
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  images: Array<{ data: string; mediaType: string }>;
  onRemoveImage: (index: number) => void;
  disabled?: boolean;
  isTyping?: boolean;
  hasMessages?: boolean; // To determine floating vs bottom mode
}

const ResponsiveChatInput: React.FC<ResponsiveChatInputProps> = ({
  message,
  onMessageChange,
  onSendMessage,
  onImageUpload,
  images,
  onRemoveImage,
  disabled = false,
  isTyping = false,
  hasMessages = false
}) => {
  const { isMobile, sidebarCollapsed, sidebarHovered } = useLayoutStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine input mode
  const inputMode = hasMessages ? 'bottom' : 'floating';

  // Calculate sidebar width for desktop positioning
  const getSidebarWidth = () => {
    if (isMobile) return 0; // No sidebar on mobile
    
    // Determine actual sidebar width based on collapsed state and hover
    const showExpandedContent = !sidebarCollapsed || sidebarHovered;
    return showExpandedContent ? 256 : 64; // w-64 = 256px, w-16 = 64px
  };

  // Handle textarea auto-resize
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onMessageChange(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // Handle send message
  const handleSendMessage = () => {
    onSendMessage();
  };

  // Get container classes based on mode and device
  const getContainerClasses = () => {
    const baseClasses = 'transition-all duration-300 ease-in-out z-10';
    
    if (isMobile) {
      if (inputMode === 'floating') {
        return cn(
          baseClasses,
          'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
          'w-[calc(100vw-2rem)] max-w-none',
          'border border-primary rounded-2xl'
        );
      } else {
        return cn(
          baseClasses,
          'fixed bottom-4 left-1/2 transform -translate-x-1/2',
          'w-[calc(100vw-2rem)] max-w-none',
          'border border-primary rounded-2xl'
        );
      }
    } else {
      // Desktop - Position will be calculated in getContainerStyle()
      if (inputMode === 'floating') {
        return cn(
          baseClasses,
          'fixed top-1/2 transform -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-2xl',
          'rounded-2xl'
        );
      } else {
        return cn(
          baseClasses,
          'fixed bottom-8 transform -translate-x-1/2',
          'w-full max-w-2xl',
          'rounded-2xl'
        );
      }
    }
  };

  // Get container style for dynamic positioning
  const getContainerStyle = (): React.CSSProperties => {
    if (isMobile) return {};
    
    const sidebarWidth = getSidebarWidth();
    const leftPosition = `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`;
    
    return {
      left: leftPosition
    };
  };

  // Get input classes
  const getInputClasses = () => {
    return cn(
      'w-full resize-none border-none bg-transparent',
      'focus:outline-none focus:ring-0',
      'placeholder-muted text-primary',
      'text-base leading-relaxed',
      inputMode === 'floating' ? 'text-lg' : 'text-base'
    );
  };

  // Get button classes (underline style for floating mode)
  const getButtonClasses = (variant: 'attach' | 'send') => {
    if (inputMode === 'floating') {
      // Underline style
      return cn(
        'px-3 py-2 border-b-2 border-transparent transition-all duration-200',
        'hover:border-blue-500 focus:border-blue-500 focus:outline-none',
        'text-muted hover:text-primary',
        variant === 'send' && !disabled && message.trim() && 'text-blue-600 border-blue-600'
      );
    } else {
      // Normal button style
      return variant === 'send' 
        ? 'btn-primary px-4 py-2'
        : 'btn-ghost p-2';
    }
  };

  return (
    <div 
      className={getContainerClasses()}
      style={getContainerStyle()}
    >
      <div className="card p-4">
        {/* Image Preview */}
        {images.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative">
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-primary"
                />
                <button
                  onClick={() => onRemoveImage(idx)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end space-x-3">
          {/* Textarea */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder={inputMode === 'floating' ? 'Ask me anything...' : 'Type your message...'}
              className={getInputClasses()}
              rows={1}
              disabled={disabled || isTyping}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1">
            {/* File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onImageUpload}
              className="hidden"
            />

            {/* Attach Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className={getButtonClasses('attach')}
              disabled={disabled || isTyping}
              title="Attach images"
            >
              <FiPlus className="h-5 w-5" />
              {inputMode === 'bottom' && <span className="sr-only">Attach</span>}
            </button>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || disabled || isTyping}
              className={getButtonClasses('send')}
              title="Send message"
            >
              <FiSend className="h-5 w-5" />
              {inputMode === 'bottom' && <span className="ml-2">Send</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveChatInput; 