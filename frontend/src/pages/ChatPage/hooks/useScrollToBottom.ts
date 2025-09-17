import { useRef, useEffect } from 'react';
import type { ChatMessage } from '../../../shared/stores/chatStore';

export const useScrollToBottom = (messages: ChatMessage[]) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return { messagesEndRef };
};