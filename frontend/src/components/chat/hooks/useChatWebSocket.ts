import { useEffect, useRef } from 'react';
import { config } from '../../../config/config';
import useChatStore from '../../../store/chatStore';
import { Message } from '../utils/types';
import { useNavigate } from 'react-router-dom';

const useChatWebSocket = () => {
  const {
    currentChatId,
    setMessages,
    setCurrentChatId,
    userScrolledManually,
    setShouldAutoScroll,
    wsRef,
    setWsRef,
    setUsage
  } = useChatStore();
  const navigate = useNavigate();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const connectWebSocket = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('Cannot connect WebSocket: No auth token');
      return null;
    }
    
    if (!currentChatId) {
      console.error('Cannot connect WebSocket: No chat ID');
      return null;
    }
    
    // Validate MongoDB ObjectId format
    const isValidObjectId = (id: string): boolean => {
      return /^[0-9a-fA-F]{24}$/.test(id);
    };
    
    if (!isValidObjectId(currentChatId)) {
      console.error(`Cannot connect WebSocket: Invalid chat ID format: ${currentChatId}`);
      return null;
    }

    console.log(`Connecting WebSocket with chat ID: ${currentChatId}`);
    const ws = new WebSocket(`${config.wsUrl}?token=${token}&chat_id=${currentChatId}`);
    setWsRef(ws);

    ws.onopen = () => {
      // Reset reconnect attempts on successful connection
      reconnectAttempts.current = 0;
      console.log('WebSocket connection established successfully');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error('Received error from WebSocket:', data.error);
          setMessages((prev: Message[]) => prev.map((msg: Message) => 
            msg.role === 'assistant' && msg === prev[prev.length - 1] ? {
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
            setCurrentChatId(data.chat_id);
            break;

          case 'content':
            setMessages((prev: Message[]) => prev.map((msg: Message) => 
              msg.role === 'assistant' && msg === prev[prev.length - 1] ? {
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
            
            setMessages((prev: Message[]) => prev.map((msg: Message) => 
              msg.role === 'assistant' && msg === prev[prev.length - 1] ? {
                ...msg,
                sources: data.sources || [],
                isComplete: true
              } : msg
            ));
            
            // Now that the response is complete, update URL with chatId
            if (data.chat_id) {
              setCurrentChatId(data.chat_id);
              navigate(`/mfuchatbot?chat=${data.chat_id}`, { replace: true });
              window.dispatchEvent(new CustomEvent('chatUpdated'));
            }
            break;

          case 'chat_updated':
            if (data.shouldUpdateList) {
              window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
            }
            break;

          case 'error':
            console.error('Error from server:', data.error);
            setMessages((prev: Message[]) => prev.map((msg: Message) => 
              msg.role === 'assistant' && msg === prev[prev.length - 1] ? {
                ...msg,
                content: `Error: ${data.error}`,
                isComplete: true
              } : msg
            ));
            break;
        }

        if (data.type === 'complete' && data.usage) {
          setUsage(data.usage);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        setMessages((prev: Message[]) => prev.map((msg: Message) => 
          msg.role === 'assistant' && msg === prev[prev.length - 1] ? {
            ...msg,
            content: 'Error processing response. Please try again.',
            isComplete: true
          } : msg
        ));
      }
    };

    ws.onclose = (event) => {
      // console.log('WebSocket connection closed');
      setWsRef(null);
      
      // Don't attempt to reconnect if we're closing cleanly (code 1000)
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        const timeout = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        console.log(`WebSocket closed. Reconnecting in ${timeout/1000}s (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current += 1;
          connectWebSocket();
        }, timeout);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return ws;
  };

  useEffect(() => {
    const ws = connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000); // Clean close
      }
      setWsRef(null);
    };
  }, [navigate, currentChatId, setCurrentChatId, setMessages, userScrolledManually, setShouldAutoScroll, setWsRef, setUsage]);

  return wsRef;
};

export default useChatWebSocket; 