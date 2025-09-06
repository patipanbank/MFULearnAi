import React, { useRef } from 'react';
import { cn } from '../../lib/utils';
import useLayoutStore from '../../stores/layoutStore';

// Components
import ChatTextArea from './components/ChatTextArea';
import ImagePreview from './components/ImagePreview';
import ActionButtons from './components/ActionButtons';
import ConnectionStatus from './components/ConnectionStatus';

// Hooks
import { useInputMode } from './hooks/useInputMode';
import { useInputValidation } from './hooks/useInputValidation';

// Styles
import { getContainerClasses, getContainerStyle, getCardClasses } from './styles/input.styles';

// Types
import type { ResponsiveChatInputProps } from './types/input.types';

const ResponsiveChatInput: React.FC<ResponsiveChatInputProps> = ({
  message,
  onMessageChange,
  onSendMessage,
  onImageUpload,
  images,
  onRemoveImage,
  disabled = false,
  isTyping = false,
  isInChatRoom = false,
  onRoomCreated: _onRoomCreated
}) => {
  const { isMobile } = useLayoutStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom hooks
  const { currentMode, isTransitioning } = useInputMode();
  const { validateMessage, handleKeyPress } = useInputValidation();

  // Handle send message with validation
  const handleSendMessage = () => {
    if (!validateMessage(message, images)) {
      return;
    }
    onSendMessage();
  };

  // Handle attach click
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // Handle key press
  const handleKeyPressWrapper = (e: React.KeyboardEvent) => {
    handleKeyPress(e, handleSendMessage);
  };

  // Check if has content for button styling
  const hasContent = validateMessage(message, images);

  return (
    <div 
      className={getContainerClasses(currentMode, isTransitioning, isMobile)}
      style={getContainerStyle(isMobile)}
    >
      <div className={cn('card', getCardClasses(currentMode))}>
        {/* Mode indicator (optional visual feedback) */}
        {isTransitioning && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}

        {/* Image Preview */}
        <ImagePreview
          images={images}
          onRemoveImage={onRemoveImage}
        />

        <div className="flex items-end space-x-3">
          {/* Textarea */}
          <ChatTextArea
            message={message}
            onMessageChange={onMessageChange}
            onKeyPress={handleKeyPressWrapper}
            disabled={disabled}
            isTyping={isTyping}
            currentMode={currentMode}
          />

          {/* Action Buttons */}
          <ActionButtons
            onSendMessage={handleSendMessage}
            onAttachClick={handleAttachClick}
            disabled={disabled}
            isTyping={isTyping}
            hasContent={hasContent}
            currentMode={currentMode}
          />
        </div>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onImageUpload}
          className="hidden"
        />

        {/* Connection Status */}
        <ConnectionStatus
          isInChatRoom={isInChatRoom}
          currentMode={currentMode}
        />
      </div>
    </div>
  );
};

export default ResponsiveChatInput;