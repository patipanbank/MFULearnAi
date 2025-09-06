import { useCallback, useRef } from 'react';
import { useChatStore, useUIStore } from '../../stores';
import type { PendingMessage } from './types/websocket.types';

export const useWebSocketMessages = ({ chatId }: { chatId?: string }) => {
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const addToast = useUIStore((state) => state.addToast);
  
  const pendingQueueRef = useRef<PendingMessage[]>([]);

  const sendMessage = useCallback((
    wsRef: React.MutableRefObject<WebSocket | null>,
    message: string, 
    images?: Array<{ url: string; mediaType: string }>, 
    agentId?: string
  ) => {
    console.log('sendMessage called', { 
      message: message.substring(0, 50) + '...', 
      images: images?.length || 0, 
      chatId, 
      agentId 
    });
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('sendMessage: WebSocket not connected, queuing message');
      pendingQueueRef.current.push({ 
        type: 'message', 
        text: message, 
        images, 
        chatId, 
        agent_id: agentId 
      });
      return;
    }
    
    try {
      const payload = { type: 'message', text: message, images, chatId, agent_id: agentId };
      console.log('sendMessage: Sending payload', payload);
      wsRef.current.send(JSON.stringify(payload));
    } catch (error) {
      console.error('sendMessage: Failed to send message', error);
      // Queue message for retry when connection is restored
      pendingQueueRef.current.push({ 
        type: 'message', 
        text: message, 
        images, 
        chatId, 
        agent_id: agentId 
      });
      addToast({
        type: 'error',
        title: 'Send Failed',
        message: 'Failed to send message. Will retry when connection is restored.',
        duration: 3000
      });
    }
  }, [addToast, chatId]);

  const processPendingMessages = useCallback((
    wsRef: React.MutableRefObject<WebSocket | null>
  ) => {
    console.log('[CHAT] WebSocket OPEN – pending', pendingQueueRef.current.length);
    
    const pendingMessages = [...pendingQueueRef.current];
    pendingQueueRef.current = [];
    
    pendingMessages.forEach((p) => {
      console.log('WebSocket: Sending pending message', p);
      try {
        // Ensure message has chatId if available
        if (p.type === 'message' && !p.chatId && chatId) {
          p.chatId = chatId;
        }
        
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify(p));
        }
      } catch (error) {
        console.error('WebSocket: Failed to send pending message', error);
        // Re-queue failed message
        pendingQueueRef.current.push(p);
      }
    });
  }, [chatId]);

  return {
    pendingQueueRef,
    sendMessage,
    processPendingMessages,
    addMessage,
    updateMessage
  };
};