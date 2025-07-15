import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores';
import { useUIStore } from '../stores';

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
  const isConnectedToRoom = useChatStore((state) => state.isConnectedToRoom);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const addToast = useUIStore((state) => state.addToast);
  
  // Track the last processed navigation to prevent duplicates
  const lastProcessedRef = useRef<{ chatId?: string; isInChatRoom: boolean; sessionId?: string } | null>(null);
  const isInitializedRef = useRef(false);

  // Memoize the connectWebSocket call to prevent unnecessary re-renders
  const memoizedConnectWebSocket = useCallback(() => {
    if (wsStatus !== 'connecting') {
      connectWebSocket();
    }
  }, [connectWebSocket, wsStatus]);

  // Combined effect for chat navigation logic
  useEffect(() => {
    const currentNavigation = { chatId, isInChatRoom, sessionId: currentSession?.id };
    
    // Check if we've already processed this exact navigation
    if (lastProcessedRef.current && 
        lastProcessedRef.current.chatId === currentNavigation.chatId &&
        lastProcessedRef.current.isInChatRoom === currentNavigation.isInChatRoom &&
        lastProcessedRef.current.sessionId === currentNavigation.sessionId) {
      console.log('ChatNavigation: Skipping duplicate navigation', currentNavigation);
      return;
    }
    
    console.log('ChatNavigation: URL changed', currentNavigation);
    lastProcessedRef.current = currentNavigation;
    
    // Handle chat loading when URL changes
    if (isInChatRoom && chatId) {
      if (currentSession && currentSession.id === chatId) {
        console.log('ChatNavigation: Same chat, connecting WebSocket if needed');
        if (!isConnectedToRoom) {
          console.log('ChatNavigation: Connecting WebSocket...');
          memoizedConnectWebSocket();
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
            memoizedConnectWebSocket();
            
            // ส่ง join_room หลังจากโหลด chat สำเร็จ
            setTimeout(() => {
              const ws = useChatStore.getState().wsStatus;
              if (ws === 'connected') {
                console.log('ChatNavigation: Sending join_room after chat loaded');
                // WebSocket จะส่ง join_room ใน onopen callback
              }
            }, 100);
          } else {
            console.log('ChatNavigation: Chat not found, showing error');
            addToast({
              type: 'error',
              title: 'Chat Not Found',
              message: 'The requested chat could not be found. It may have been deleted or you may not have permission to access it.',
              duration: 5000
            });
          }
        } catch (error) {
          console.error('ChatNavigation: Failed to load chat:', error);
          addToast({
            type: 'error',
            title: 'Failed to Load Chat',
            message: 'An error occurred while loading the chat. Please try again.',
            duration: 5000
          });
        }
      };
      
      handleChatLoad();
    } else {
      // Handle new chat creation - เพิ่ม guard เพื่อป้องกันการทำงานซ้ำ
      if (!isInitializedRef.current) {
        console.log('ChatNavigation: Creating new chat');
        if (!currentSession || !currentSession.id.startsWith('chat_')) {
          createNewChat();
          isInitializedRef.current = true;
        } else {
          // ถ้ามี currentSession แล้ว ให้เชื่อมต่อ WebSocket
          console.log('ChatNavigation: Existing chat session, connecting WebSocket');
          memoizedConnectWebSocket();
          isInitializedRef.current = true;
        }
      }
    }
  }, [chatId, isInChatRoom]); // ลบ currentSession ออกจาก dependency เพื่อป้องกันการทำงานซ้ำ

  // Reset initialization flag when URL changes
  useEffect(() => {
    isInitializedRef.current = false;
  }, [chatId, isInChatRoom]);

  return {
    // These functions are now handled by the useEffect above
  };
}; 