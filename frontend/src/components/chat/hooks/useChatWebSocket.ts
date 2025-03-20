import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStateStore } from '../../../store/chatStateStore';
import { useChatActionsStore } from '../../../store/chatActionsStore';

export const useChatWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();
  
  const {
    messages,
    currentChatId,
    setMessages,
    setCurrentChatId,
    setIsLoading,
    fetchUsage
  } = useChatStateStore();
  
  const {
    userScrolledManually,
    setShouldAutoScroll,
    setWsRef
  } = useChatActionsStore();

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('No auth token found');
      navigate('/login');
      return;
    }

    const wsUrl = new URL(process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws');
    wsUrl.searchParams.append('token', token);
    
    if (currentChatId) {
      wsUrl.searchParams.append('chatId', currentChatId);
    }
    
    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;
    setWsRef(ws);

    ws.onopen = () => {
      // console.log('WebSocket connection established');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chatCreated') {
          // Update chat ID in URL and state
          const newChatId = data.chatId;
          setCurrentChatId(newChatId);
          
          // Update URL without reloading the page
          const url = new URL(window.location.href);
          url.searchParams.set('chat', newChatId);
          window.history.pushState({}, '', url.toString());
          
          return;
        }
        
        if (data.type === 'message') {
          // Update existing messages
          const updatedMessages = [...messages];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          
          if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isComplete) {
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMessage,
              content: data.content,
              images: data.images || [],
              sources: data.sources || [],
              isComplete: data.isComplete
            };
            
            setMessages(updatedMessages);
            
            // Re-enable auto-scrolling after first message chunk if user hasn't scrolled manually
            if (!userScrolledManually) {
              setShouldAutoScroll(true);
            }
            
            // Fetch usage stats when message completes
            if (data.isComplete) {
              fetchUsage();
            }
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      // console.log('WebSocket connection closed');
      setIsLoading(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsLoading(false);
    };

    return () => {
      ws.close();
    };
  }, [
    navigate, 
    currentChatId, 
    setCurrentChatId, 
    messages, 
    setMessages, 
    userScrolledManually, 
    setShouldAutoScroll, 
    fetchUsage,
    setIsLoading,
    setWsRef
  ]);

  return {
    wsRef
  };
};

export default useChatWebSocket; 