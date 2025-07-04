import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores';

interface UseChatNavigationOptions {
  chatId?: string;
  isInChatRoom: boolean;
  connectWebSocket: () => void;
}

export const useChatNavigation = ({ chatId, isInChatRoom, connectWebSocket }: UseChatNavigationOptions) => {
  const navigate = useNavigate();
  const currentSession = useChatStore((state) => state.currentSession);
  const loadChat = useChatStore((state) => state.loadChat);
  const createNewChat = useChatStore((state) => state.createNewChat);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);
  const isConnectedToRoom = useChatStore((state) => state.isConnectedToRoom);

  // Combined effect for chat navigation logic
  useEffect(() => {
    console.log('ChatNavigation: URL changed', { chatId, isInChatRoom, currentSessionId: currentSession?.id });
    
    // Handle chat loading when URL changes
    if (isInChatRoom && chatId) {
      if (currentSession && currentSession.id === chatId) {
        console.log('ChatNavigation: Same chat, connecting WebSocket if needed');
        if (!isConnectedToRoom) {
          console.log('ChatNavigation: Connecting WebSocket...');
          connectWebSocket();
        }
        return; // already loaded
      }

      // Use a separate function to avoid async in useEffect
      const handleChatLoad = async () => {
        console.log('ChatNavigation: Loading chat', chatId);
        try {
          const ok = await loadChat(chatId);
          if (ok) {
            console.log('ChatNavigation: Chat loaded successfully, connecting WebSocket');
            connectWebSocket();
          } else {
            console.log('ChatNavigation: Chat not found, redirecting to /chat');
            navigate('/chat');
            createNewChat();
          }
        } catch (error) {
          console.error('ChatNavigation: Failed to load chat:', error);
          navigate('/chat');
          createNewChat();
        }
      };
      
      handleChatLoad();
    } else {
      // Handle new chat creation
      console.log('ChatNavigation: Creating new chat');
      if (!currentSession || !currentSession.id.startsWith('chat_')) {
        createNewChat();
      }
    }
  }, [chatId, isInChatRoom, currentSession, loadChat, connectWebSocket, navigate, createNewChat, isConnectedToRoom]);

  // Effect for session ID update
  useEffect(() => {
    if (isInChatRoom && chatId && currentSession && currentSession.id !== chatId) {
      setCurrentSession({
        ...currentSession,
        id: chatId,
      });
    }
  }, [chatId, isInChatRoom, currentSession, setCurrentSession]);

  return {
    // These functions are now handled by the useEffect above
  };
}; 