import React, { useRef } from 'react';
import { FiSend, FiPlus, FiX } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import useLayoutStore from '../../stores/layoutStore';

interface ResponsiveChatInputProps {
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  images: Array<{ url: string; mediaType: string }>;
  onRemoveImage: (index: number) => void;
  disabled?: boolean;
  isTyping?: boolean;
  onRoomCreated?: (roomId: string) => void;
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
  onRoomCreated: _onRoomCreated
}) => {
  const { isMobile, sidebarCollapsed, sidebarHovered } = useLayoutStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Always fixed bottom mode, no state needed

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
      handleSendMessage();
    }
  };

  // Handle send message with room creation logic
  const handleSendMessage = () => {
    if (!message.trim()) {
      console.log('[INPUT] Empty message, skip');
      return;
    }

    console.log('[INPUT] handleSendMessage fired', { disabled });

    // Under the new lazy-room-create flow, front-end no longer generates a
    // temporary chatId.  Instead, ChatPage will send a `create_room` event and
    // wait for `room_created` from the backend.  Therefore we simply delegate
    // to onSendMessage() here.

    onSendMessage();
  };

  // Get container classes based on mode and device with enhanced animations
  const getContainerClasses = () => {
    const baseClasses = cn(
      'transition-all duration-500 ease-in-out z-[5]',
      'transform-gpu'
    );
    if (isMobile) {
      return cn(
        baseClasses,
        'fixed bottom-4 left-1/2 -translate-x-1/2',
        'w-[calc(100vw-2rem)] max-w-none',
        'border border-primary rounded-2xl shadow-lg',
        'bg-background',
        'opacity-100 translate-y-0'
      );
    } else {
      return cn(
        baseClasses,
        'fixed bottom-8 -translate-x-1/2',
        'w-full max-w-2xl',
        'rounded-2xl shadow-lg',
        'bg-background border border-primary',
        'opacity-100 translate-y-0'
      );
    }
  };

  // Get container style for dynamic positioning with smooth transitions
  const getContainerStyle = (): React.CSSProperties => {
    if (isMobile) return {};
    
    const sidebarWidth = getSidebarWidth();
    const leftPosition = `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`;
    
    return {
      left: leftPosition,
      transition: 'left 300ms ease-in-out' // Smooth sidebar transition
    };
  };

  // Get input classes with enhanced styling
  const getInputClasses = () => {
    return cn(
      'w-full resize-none border-none bg-transparent',
      'focus:outline-none focus:ring-0',
      'placeholder-muted text-primary',
      'text-base leading-relaxed transition-all duration-300',
      'text-base py-1'
    );
  };

  // Get button classes with enhanced styling for different modes
  const getButtonClasses = (variant: 'attach' | 'send') => {
    // Only use fixed bottom mode style
    const baseClasses = 'transition-all duration-200 transform hover:scale-105 active:scale-95';
    return variant === 'send' 
      ? cn('btn-primary px-4 py-2 shadow-md', baseClasses)
      : cn('btn-ghost p-2 hover:bg-primary/10', baseClasses);
  };

  // Get card styling based on mode
  const getCardClasses = () => {
    return cn(
      'transition-all duration-300',
      'p-4'
    );
  };

  return (
    <div 
      className={getContainerClasses()}
      style={getContainerStyle()}
    >
      <div className={cn('card', getCardClasses())}>
        {/* Image Preview */}
        {images.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.url}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-primary transition-transform group-hover:scale-105"
                />
                <button
                  onClick={() => onRemoveImage(idx)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-all duration-200 transform hover:scale-110"
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
              placeholder={'Type your message...'}
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
            </button>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || disabled || isTyping}
              className={getButtonClasses('send')}
              title="Send message"
            >
              <FiSend className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveChatInput; 