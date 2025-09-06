import { useCallback } from 'react';

export const useInputValidation = () => {
  const validateMessage = useCallback((message: string, images: any[]) => {
    return message.trim().length > 0 || images.length > 0;
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent, onSendMessage: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  }, []);

  return {
    validateMessage,
    handleKeyPress
  };
};