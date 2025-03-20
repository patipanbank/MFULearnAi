import { useEffect, useRef } from 'react';
import { Message } from '../utils/types';
import { useNavigate } from 'react-router-dom';
import { isValidObjectId } from '../utils/formatters';

// Add a logger utility
const logger = {
  log: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[WebSocket] ${message}`, data || '');
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[WebSocket] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WebSocket] ${message}`, data || '');
  }
};

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
    if (!token) {
      logger.error('No auth token found for WebSocket connection');
      return;
    }

    // ปิดการเชื่อมต่อ WebSocket เดิมถ้ามี
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      logger.log('Closing existing WebSocket connection');
      wsRef.current.close();
    }

    const wsUrl = new URL(import.meta.env.VITE_WS_URL);
    wsUrl.searchParams.append('token', token);
    
    // Only append chatId if it's a valid ObjectId
    if (currentChatId && isValidObjectId(currentChatId)) {
      logger.log('Appending chatId to WebSocket URL', { chatId: currentChatId });
      wsUrl.searchParams.append('chat', currentChatId);
    } else if (currentChatId) {
      logger.warn('Invalid chatId not appended to WebSocket URL', { chatId: currentChatId });
    }
    
    logger.log('Creating new WebSocket connection', { url: wsUrl.toString() });
    wsRef.current = new WebSocket(wsUrl.toString());

    wsRef.current.onopen = () => {
      logger.log('WebSocket connection established');
    };

    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        logger.log('WebSocket message received', { type: data.type });
        
        if (data.error) {
          logger.error('Received error from WebSocket', data.error);
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
            logger.log('Chat created event', { chatId: data.chatId });
            // Just store the chatId, don't update URL yet
            setCurrentChatId(data.chatId);
            break;

          case 'content':
            // No need to log every content chunk to avoid console spam
            setMessages(prev => prev.map((msg, index) => 
              index === prev.length - 1 && msg.role === 'assistant' ? {
                ...msg,
                content: msg.content + data.content
              } : msg
            ));
            break;

          case 'complete':
            logger.log('Response complete event', { 
              chatId: data.chatId,
              hasSources: !!data.sources && data.sources.length > 0
            });
            
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
              logger.log('Updating URL with chatId', { chatId: data.chatId });
              navigate(`/mfuchatbot?chat=${data.chatId}`, { replace: true });
              window.dispatchEvent(new CustomEvent('chatUpdated'));
            }
            break;

          case 'chat_updated':
            logger.log('Chat updated event', { shouldUpdateList: data.shouldUpdateList });
            if (data.shouldUpdateList) {
              window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
            }
            break;

          case 'error':
            logger.error('Error from server', data.error);
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
        logger.error('Error handling WebSocket message', error);
        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 && msg.role === 'assistant' ? {
            ...msg,
            content: 'Error processing response. Please try again.',
            isComplete: true
          } : msg
        ));
      }
    };

    wsRef.current.onclose = (event) => {
      logger.log('WebSocket connection closed', { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean
      });
    };

    wsRef.current.onerror = (error) => {
      logger.error('WebSocket error', error);
    };

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        logger.log('Cleaning up WebSocket connection');
        wsRef.current.close();
      }
    };
  }, [navigate, currentChatId, setCurrentChatId, setMessages, fetchUsage, userScrolledManually, setShouldAutoScroll]);

  return wsRef;
};

export default useChatWebSocket; 