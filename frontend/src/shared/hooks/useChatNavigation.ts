import { useEffect } from 'react';
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
  // Note: setCurrentSession is no longer used since we removed the session ID update effect
  const isConnectedToRoom = useChatStore((state) => state.isConnectedToRoom);
  const addToast = useUIStore((state) => state.addToast);

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
            // แสดง error แทนการ redirect
            // navigate('/chat');
            // createNewChat();
          }
        } catch (error) {
          console.error('ChatNavigation: Failed to load chat:', error);
          addToast({
            type: 'error',
            title: 'Failed to Load Chat',
            message: 'An error occurred while loading the chat. Please try again.',
            duration: 5000
          });
          // แสดง error แทนการ redirect
          // navigate('/chat');
          // createNewChat();
        }
      };
      
      handleChatLoad();
    } else {
      // Handle new chat creation
      console.log('ChatNavigation: Creating new chat');
      if (!currentSession || !currentSession.id.startsWith('chat_')) {
        createNewChat();
        // เชื่อมต่อ WebSocket หลังจากสร้าง new chat
        setTimeout(() => {
          console.log('ChatNavigation: Connecting WebSocket for new chat');
          connectWebSocket();
        }, 100);
      } else {
        // ถ้ามี currentSession แล้ว ให้เชื่อมต่อ WebSocket
        console.log('ChatNavigation: Existing chat session, connecting WebSocket');
        connectWebSocket();
      }
    }
  }, [chatId, isInChatRoom, currentSession, loadChat, connectWebSocket, navigate, createNewChat, isConnectedToRoom, addToast]);

  // Effect for session ID update - ลบออกเพราะไม่ควรอัปเดต ID โดยไม่โหลดข้อมูลจริง
  // useEffect(() => {
  //   if (isInChatRoom && chatId && currentSession && currentSession.id !== chatId) {
  //     setCurrentSession({
  //       ...currentSession,
  //       id: chatId,
  //     });
  //   }
  // }, [chatId, isInChatRoom, currentSession, setCurrentSession]);

  return {
    // These functions are now handled by the useEffect above
  };
}; 