import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../stores';

export const useChatInput = () => {
  const { currentSession, setIsTyping } = useChatStore();
  
  // Local state
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Array<{ url: string; mediaType: string }>>([]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // Reset input local state when switching to a different session
  useEffect(() => {
    // Whenever session ID changes, clear draft message & images
    setMessage('');
    setImages([]);
    // Also reset typing indicator
    setIsTyping(false);
  }, [currentSession?.id, setIsTyping]);

  return {
    message,
    setMessage,
    images,
    setImages,
    messagesEndRef
  };
}; 