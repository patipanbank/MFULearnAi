import { useRef } from 'react';
import { useUIStore } from '../../../shared/stores';

export const useChatUI = () => {
  const isLoading = useUIStore((state) => state.isLoading);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return {
    isLoading,
    messagesEndRef,
    scrollToBottom
  };
};