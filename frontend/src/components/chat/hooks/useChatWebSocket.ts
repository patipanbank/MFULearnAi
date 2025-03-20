import { useEffect, useRef } from 'react';
import { Message } from '../utils/types';
import { useNavigate } from 'react-router-dom';
import { isValidObjectId } from '../utils/formatters';

interface UseWebSocketProps {
  currentChatId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  fetchUsage: () => Promise<void>;
  userScrolledManually: boolean;
  setShouldAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
}

const useChatWebSocket = ({
  currentChatId,
  setMessages,
  setCurrentChatId,
  fetchUsage,
  userScrolledManually,
  setShouldAutoScroll
}: UseWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // ปิดการเชื่อมต่อ WebSocket เดิมถ้ามี
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const wsUrl = new URL(import.meta.env.VITE_WS_URL);
    wsUrl.searchParams.append('token', token);
    
    // Only append chatId if it's a valid ObjectId
    if (currentChatId && isValidObjectId(currentChatId)) {
      wsUrl.searchParams.append('chat', currentChatId);
    }
    
    wsRef.current = new WebSocket(wsUrl.toString());

    wsRef.current.onopen = () => {
      // console.log('WebSocket connection established');
    };

    wsRef.current.onmessage = async (event) => {
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
            
            // Now that the response is complete, update URL with chatId
            if (data.chatId) {
              setCurrentChatId(data.chatId);
              navigate(`/mfuchatbot?chat=${data.chatId}`, { replace: true });
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
            setMessages(prev => prev.map((msg, index) => 
              index === prev.length - 1 && msg.role === 'assistant' ? {
                ...msg,
                content: `Error: ${data.error}`,
                isComplete: true
              } : msg
            ));
            break;
        }

        // อัพเดท usage หลังจากได้รับข้อความ
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

    wsRef.current.onclose = () => {
      // console.log('WebSocket connection closed');
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [navigate, currentChatId, setCurrentChatId, setMessages, fetchUsage, userScrolledManually, setShouldAutoScroll]);

  return wsRef;
};

export default useChatWebSocket; 