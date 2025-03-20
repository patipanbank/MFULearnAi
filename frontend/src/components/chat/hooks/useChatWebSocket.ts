import { useEffect } from 'react';
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
  
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !currentChatId) return;

    const ws = new WebSocket(`${config.wsUrl}?token=${token}&chat_id=${currentChatId}`);
    setWsRef(ws);

    ws.onopen = () => {
      // console.log('WebSocket connection established');
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

    ws.onclose = () => {
      // console.log('WebSocket connection closed');
      setWsRef(null);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      setWsRef(null);
    };
  }, [navigate, currentChatId, setCurrentChatId, setMessages, userScrolledManually, setShouldAutoScroll, setWsRef, setUsage]);

  return wsRef;
};

export default useChatWebSocket; 