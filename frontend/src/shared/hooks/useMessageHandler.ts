import { useCallback } from 'react';
import { useChatStore, useAgentStore, useUIStore } from '../stores';
import type { ChatMessage } from '../stores/chatStore';

export const useMessageHandler = () => {
  const { 
    currentSession, 
    addMessage, 
    updateMessage,
    setIsTyping,
    setIsRoomCreating
  } = useChatStore();
  
  const { selectedAgent } = useAgentStore();
  const { addToast: addUIToast } = useUIStore();

  // Helper to mark current streaming assistant as aborted
  const abortStreaming = useCallback((reason: string) => {
    if (!currentSession) return;
    const lastMsg = currentSession.messages[currentSession.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
      updateMessage(lastMsg.id, {
        content: lastMsg.content + `\n[${reason}]`,
        isStreaming: false,
        isComplete: true,
      });
    }
    setIsTyping(false);
  }, [currentSession, updateMessage, setIsTyping]);

  // Handle WebSocket message
  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'chunk') {
      // Support new format with messageId
      if (data?.data && typeof data.data === 'object' && data.data.messageId) {
        const { messageId, delta } = data.data as { messageId: string; delta?: string };
        updateMessage(messageId, (prev: any) => ({
          content: ((prev?.content ?? '') as string) + (delta ?? '')
        }) as any);
        return;
      }
      // Fallback legacy
      const lastMessage = currentSession?.messages[currentSession.messages.length - 1];
      let chunkText = '';
      if (typeof data.data === 'string') {
        chunkText = data.data;
      } else if (typeof data.data === 'object' && data.data !== null) {
        chunkText = data.data.delta || data.data.chunk || data.data.fullContent || '';
      } else {
        chunkText = String(data.data ?? '');
      }
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        updateMessage(lastMessage.id, { content: lastMessage.content + chunkText });
      } else {
        console.log('Waiting for backend to create assistant message...');
      }
    } else if (data.type === 'assistant_created') {
      // Backend สร้าง assistant message ใหม่แล้ว
      const assistantMsg: ChatMessage = {
        id: data.data.messageId,
        role: 'assistant',
        content: data.data.content,
        timestamp: new Date(),
        isStreaming: true,
        isComplete: false
      };
      addMessage(assistantMsg);
    } else if (data.type === 'room_created') {
      // Handle room creation
      setIsRoomCreating(false);
    } else if (data.type === 'end') {
      // Mark message as complete; prefer messageId from new backend
      const messageId = data?.data?.messageId as string | undefined;
      if (messageId) {
        updateMessage(messageId, { isComplete: true, isStreaming: false });
      } else {
        const lastMessage = currentSession?.messages[currentSession.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          updateMessage(lastMessage.id, { isComplete: true, isStreaming: false });
        }
      }
      setIsTyping(false);
    } else if (data.type === 'error') {
      console.error('WebSocket error:', data.data);
      addUIToast({
        type: 'error',
        title: 'Chat Error',
        message: data.data
      });
      abortStreaming('ERROR');
    } else {
      // Fallback: log any unexpected messages for easier debugging
      console.debug('WS unhandled event', data);
    }
  }, [currentSession, updateMessage, addMessage, setIsTyping, setIsRoomCreating, addUIToast, abortStreaming]);

  // Handle room creation
  const handleRoomCreated = useCallback((roomId: string) => {
    console.log('Creating new chat room:', roomId);
    setIsRoomCreating(false);
  }, [setIsRoomCreating]);

  // Validate message before sending
  const validateMessage = useCallback((message: string) => {
    if (!message.trim()) {
      return { valid: false, error: 'Message cannot be empty' };
    }
    
    if (!selectedAgent) {
      return { 
        valid: false, 
        error: 'Please select an AI agent before sending a message.' 
      };
    }

    return { valid: true };
  }, [selectedAgent]);

  // Create user message
  const createUserMessage = useCallback((content: string, images: Array<{ url: string; mediaType: string }> = []) => {
    const userTimestamp = new Date();
    userTimestamp.setHours(userTimestamp.getHours() - 7);
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: userTimestamp,
      images: images.length > 0 ? images : undefined
    };
    
    return userMessage;
  }, []);

  // Create assistant placeholder
  const createAssistantPlaceholder = useCallback(() => {
    const placeholder: ChatMessage = {
      id: Date.now().toString() + '_assistant',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      isComplete: false
    };
    return placeholder;
  }, []);

  return {
    abortStreaming,
    handleWebSocketMessage,
    handleRoomCreated,
    validateMessage,
    createUserMessage,
    createAssistantPlaceholder
  };
}; 