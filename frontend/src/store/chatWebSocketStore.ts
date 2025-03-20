import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from './chatStore';
import { isValidObjectId } from '../components/chat/utils/formatters';
import { useScrollStore } from './scrollStore';

interface WebSocketState {
  wsRef: React.MutableRefObject<WebSocket | null> | null;
  initializeWebSocket: (props: {
    currentChatId: string | null;
    userScrolledManually: boolean;
    setShouldAutoScroll: (shouldScroll: boolean) => void;
  }) => (() => void) | undefined;
}

export const useWebSocketStore = create<WebSocketState>((set, _get) => ({
  wsRef: null,
  
  initializeWebSocket: ({ currentChatId, userScrolledManually, setShouldAutoScroll }) => {
    const chatStore = useChatStore.getState();
    const { setMessages, setCurrentChatId, fetchUsage } = chatStore;
    
    // Create WebSocket connection
    const token = localStorage.getItem('auth_token');
    if (!token) return undefined;

    const wsUrl = new URL(import.meta.env.VITE_WS_URL);
    wsUrl.searchParams.append('token', token);
    
    // Only append chatId if it's a valid ObjectId
    if (currentChatId && isValidObjectId(currentChatId)) {
      wsUrl.searchParams.append('chat', currentChatId);
    }
    
    const ws = new WebSocket(wsUrl.toString());
    
    ws.onopen = () => {
      // console.log('WebSocket connection established');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error('Received error from WebSocket:', data.error);
          setMessages(prev => prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant' ? {
              ...msg,
              content: `Error: ${data.error}`,
              isComplete: true
            } : msg
          ));
          return;
        }

        // Handle different message types
        switch (data.type) {
          case 'chat_created':
            // Just store the chatId, don't update URL yet
            setCurrentChatId(data.chatId);
            break;

          case 'content':
            setMessages(prev => prev.map((msg, index) => 
              index === prev.length - 1 && msg.role === 'assistant' ? {
                ...msg,
                content: msg.content + data.content
              } : msg
            ));
            break;

          case 'complete':
            // Re-enable auto-scrolling when message is complete, but respect user's reading position
            if (!userScrolledManually) {
              setShouldAutoScroll(true);
            }
            
            setMessages(prev => {
              const updatedMessages = prev.map((msg, index) => 
                index === prev.length - 1 && msg.role === 'assistant' ? {
                  ...msg,
                  sources: data.sources || [],
                  isComplete: true
                } : msg
              );
              return updatedMessages;
            });
            
            // Now that the response is complete, update URL with chatId if available
            if (data.chatId) {
              setCurrentChatId(data.chatId);
            }
            break;

          case 'chat_updated':
            if (data.shouldUpdateList) {
              window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
            }
            break;

          case 'error':
            console.error('Error from server:', data.error);
            setMessages(prev => prev.map((msg, index) => 
              index === prev.length - 1 && msg.role === 'assistant' ? {
                ...msg,
                content: `Error: ${data.error}`,
                isComplete: true
              } : msg
            ));
            break;
        }

        // Update usage after receiving complete message
        if (data.type === 'complete') {
          await fetchUsage();
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 && msg.role === 'assistant' ? {
            ...msg,
            content: 'Error processing response. Please try again.',
            isComplete: true
          } : msg
        ));
      }
    };

    ws.onclose = () => {
      // console.log('WebSocket connection closed');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    // Save the WebSocket reference in the window to make it accessible to action handlers
    (window as any).currentWebSocket = ws;
    
    // Also save in the store
    const wsRefObj = { current: ws } as React.MutableRefObject<WebSocket | null>;
    set({ wsRef: wsRefObj });
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      (window as any).currentWebSocket = null;
    };
  }
}));

// Custom hook to use WebSocket with the chat store
export const useChatWebSocketConnection = (userScrolledManually: boolean) => {
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);
  const { currentChatId, setCurrentChatId } = useChatStore();
  const { initializeWebSocket } = useWebSocketStore();
  const setShouldAutoScroll = useScrollStore(state => state.setShouldAutoScroll);
  
  useEffect(() => {
    const cleanup = initializeWebSocket({
      currentChatId,
      userScrolledManually,
      setShouldAutoScroll
    });
    
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [currentChatId, userScrolledManually, setShouldAutoScroll, initializeWebSocket]);
  
  // Handle URL updates when chat ID changes
  useEffect(() => {
    if (currentChatId) {
      navigate(`/mfuchatbot?chat=${currentChatId}`, { replace: true });
      window.dispatchEvent(new CustomEvent('chatUpdated'));
    }
  }, [currentChatId, navigate]);
  
  return wsRef;
}; 