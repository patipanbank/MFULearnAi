import { useRef, useCallback } from 'react';

export const useInputResize = () => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>, onMessageChange: (message: string) => void) => {
    onMessageChange(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  return {
    textareaRef,
    handleTextareaChange
  };
};