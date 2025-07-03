import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import type { ChatMessage } from '../../shared/stores/chatStore';
import { config } from '../../config/config';
import ResponsiveChatInput from '../../shared/ui/ResponsiveChatInput';
import { api } from '../../shared/lib/api';
import Loading from '../../shared/ui/Loading';
import dindinAvatar from '../../assets/dindin.png';
import dindinNp from '../../assets/dindin_np.PNG';

const ChatPage: React.FC = React.memo(() => {
  const { user, token, refreshToken } = useAuthStore();
  const { 
    currentSession, 
    addMessage, 
    updateMessage,
    createNewChat,
    wsStatus,
    setWsStatus,
    isTyping,
    setIsTyping,
    setCurrentSession,
    chatHistory,
    setChatHistory,
    loadChat,
    isLoading
  } = useChatStore();
  
  const { 
    selectedAgent,
    fetchAgents
  } = useAgentStore();
  
  const { setLoading, addToast } = useUIStore();
  
  // Navigation
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  
  // Local state
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Array<{ url: string; mediaType: string }>>([]);
  const [isConnectedToRoom, setIsConnectedToRoom] = useState(false);
  const [isRoomCreating, setIsRoomCreating] = useState(false);
  
  // Use a ref for the first pending message so the latest value is always
  // visible inside WebSocket callbacks (avoids stale closure issues).
  type PendingFirst = {
    text: string;
    images: Array<{ url: string; mediaType: string }>;
    agentId?: string;
  } | null;

  const pendingFirstRef = useRef<PendingFirst>(null);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Keep a ref to always access latest session inside websocket callbacks
  const currentSessionRef = useRef<typeof currentSession>(null); // NEW REF
  // Keep latest chatHistory to avoid stale closure
  const chatHistoryRef = useRef<typeof chatHistory>(chatHistory);
  
  // Queue of pending payloads when websocket is not yet connected
  type PendingPayload = Record<string, any>; // generic event payload

  const pendingQueueRef = useRef<PendingPayload[]>([]);
  
  // Memoize computed values
  const isInChatRoom = useMemo(() => Boolean(chatId), [chatId]);
  const hasMessages = useMemo(() => (currentSession?.messages.length || 0) > 0, [currentSession?.messages.length]);
  
  // Debug render
  console.log('ChatPage - RENDER:', {
    chatId,
    isInChatRoom,
    hasMessages,
    currentSessionId: currentSession?.id,
    timestamp: new Date().toISOString()
  });
  
  // Memoize initialization function
  const initializeData = useCallback(async () => {
    setLoading(true, 'Loading agents...');
    try {
      await fetchAgents();
    } catch (error) {
      console.error('Failed to initialize data:', error);
      addToast({
        type: 'error',
        title: 'Initialization Error',
        message: 'Failed to load agents'
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAgents, setLoading, addToast]);
  
  // Initialize data on mount
  useEffect(() => {
    initializeData();
  }, []); // Remove store functions from dependencies
  
  // Cleanup placeholder chats (id not ObjectId) once on mount
  useEffect(() => {
    setChatHistory(chatHistory.filter((c) => c.id && c.id.length === 24));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Memoize chat loading function
  const loadChatAndConnect = useCallback(async () => {
    if (!chatId) return;
    
    const ok = await loadChat(chatId);
    if (ok) {
      connectWebSocket();
    } else {
      navigate('/chat');
      createNewChat();
    }
  }, [chatId, loadChat, navigate, createNewChat]);
  
  // เมื่อ URL มี chatId ให้โหลดประวัติหนึ่งครั้งและเชื่อม WS
  useEffect(() => {
    if (!isInChatRoom || !chatId) return;

    if (currentSession && currentSession.id === chatId) {
      if (!isConnectedToRoom) connectWebSocket();
      return; // already loaded
    }

    loadChatAndConnect();
  }, [chatId, isInChatRoom, currentSession?.id, isConnectedToRoom]); // Remove store functions

  // กรณี /chat (ไม่มี id)
  useEffect(() => {
    if (isInChatRoom) return; // handled above
    
    // If we are on /chat but the current session is a real, saved chat,
    // we must create a new one to prevent sending messages to the old chat.
    if (!currentSession || !currentSession.id.startsWith('chat_')) {
      createNewChat();
    }
  }, [isInChatRoom, currentSession?.id]); // Remove store functions
  
  // Update session ID when chat room changes
  useEffect(() => {
    if (isInChatRoom && chatId && currentSession && currentSession.id !== chatId) {
      // Update current session ID to match the chat room
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          id: chatId,
        });
      }
    }
  }, [chatId, isInChatRoom, currentSession?.id]); // Remove store functions
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);
  
  // Update ref whenever state changes
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);
  
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);
  
  // Reset input local state when switching to a different session (e.g., New Chat)
  useEffect(() => {
    // Whenever session ID changes, clear draft message & images
    setMessage('');
    setImages([]);
    // Also reset typing indicator and pending queue
    setIsTyping(false);
    pendingQueueRef.current = [];
  }, [currentSession?.id]); // Remove store functions
  
  // Helper function to check if token is expired
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < currentTime;
    } catch {
      return true; // Consider invalid tokens as expired
    }
  }, []);

  // Helper function to try token refresh and reconnect
  const tryRefreshAndReconnect = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Attempting to refresh token...');
      const newToken = await refreshToken();
      if (newToken) {
        console.log('Token refreshed successfully, reconnecting WebSocket...');
        // Small delay to ensure token is updated in store
        setTimeout(() => {
          connectWebSocket();
        }, 500);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }, [refreshToken]);

  // Memoize WebSocket connection function
  const connectWebSocket = useCallback(() => {
    // Implementation will be added here
    console.log('WebSocket connection logic would go here');
  }, []);

  // Memoize message sending function
  const sendMessage = useCallback(async () => {
    // Implementation will be added here
    console.log('Message sending logic would go here');
  }, []);

  // Memoize image upload handler
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Implementation will be added here
    console.log('Image upload logic would go here');
  }, []);

  // Memoize image removal handler
  const handleRemoveImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Memoize initials function
  const getInitials = useCallback(() => {
    if (!user) return 'U';
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  }, [user?.firstName, user?.lastName]);

  // Rest of the component implementation...
  // (The rest of the component would continue here with the same pattern)

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages would be rendered here */}
      <div className="flex-1 overflow-auto p-4">
        <div className="text-center text-muted">
          Chat interface would be rendered here
        </div>
      </div>
      
      {/* Chat input */}
      <div className="border-t border-border p-4">
        <ResponsiveChatInput
          value={message}
          onChange={setMessage}
          onSend={sendMessage}
          onImageUpload={handleImageUpload}
          images={images}
          onRemoveImage={handleRemoveImage}
          isTyping={isTyping}
          disabled={!user}
        />
      </div>
      
      {/* Auto-scroll target */}
      <div ref={messagesEndRef} />
    </div>
  );
});

export default ChatPage; 