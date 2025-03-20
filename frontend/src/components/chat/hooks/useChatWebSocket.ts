import { useEffect, useRef, useCallback } from 'react';
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
  const reconnectAttemptRef = useRef<number>(0);
  const maxReconnectAttempts = 3;
  
  // Create function to establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Close existing connection if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
      console.log('WebSocket connection established');
      // Reset reconnect attempts on successful connection
      reconnectAttemptRef.current = 0;
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
            console.log('Chat created with ID:', data.chatId);
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

          default:
            console.log('Received unknown message type:', data.type);
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

    wsRef.current.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      
      // Attempt to reconnect unless closed intentionally
      if (event.code !== 1000) {
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          reconnectAttemptRef.current++;
          console.log(`Reconnect attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts}`);
          setTimeout(connectWebSocket, 1000 * reconnectAttemptRef.current);
        } else {
          console.error('Maximum WebSocket reconnect attempts reached');
        }
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [currentChatId, navigate, setCurrentChatId, setMessages, userScrolledManually, setShouldAutoScroll, fetchUsage]);

  // Set up WebSocket connection and clean up on unmount
  useEffect(() => {
    // Connect initially
    connectWebSocket();
    
    // Clean up on component unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connectWebSocket]);

  return wsRef;
};

export default useChatWebSocket; 