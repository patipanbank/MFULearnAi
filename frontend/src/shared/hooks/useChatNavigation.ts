import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores';

interface UseChatNavigationOptions {
  chatId?: string;
  isInChatRoom: boolean;
  connectWebSocket: () => void;
}

export const useChatNavigation = ({ chatId, isInChatRoom, connectWebSocket }: UseChatNavigationOptions) => {
  const navigate = useNavigate();
  const { 
    currentSession, 
    loadChat, 
    createNewChat,
    setCurrentSession,
    isConnectedToRoom
  } = useChatStore();

  // Combined effect for chat navigation logic
  useEffect(() => {
    // Handle chat loading when URL changes
    if (isInChatRoom && chatId) {
      if (currentSession && currentSession.id === chatId) {
        if (!isConnectedToRoom) connectWebSocket();
        return; // already loaded
      }

      (async () => {
        const ok = await loadChat(chatId);
        if (ok) {
          connectWebSocket();
        } else {
          navigate('/chat');
          createNewChat();
        }
      })();
    } else {
      // Handle new chat creation
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