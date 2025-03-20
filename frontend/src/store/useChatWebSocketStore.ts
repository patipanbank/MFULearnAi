import { create } from 'zustand';
import { config } from '../config/config';
import useChatStore from './useChatStore';
import { Message } from '../components/chat/utils/types';

interface WebSocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  
  initializeWebSocket: () => void;
  reconnect: () => void;
  closeWebSocket: () => void;
  sendMessage: (messages: Message[], modelId: string, isImageGeneration: boolean, path: string, chatId: string | null) => void;
}

const SOCKET_RECONNECT_ATTEMPTS = 5;
const SOCKET_RECONNECT_DELAY = 2000;

const useChatWebSocketStore = create<WebSocketState>((set, get) => ({
  ws: null,
  isConnected: false,
  isReconnecting: false,
  reconnectAttempts: 0,
  
  initializeWebSocket: () => {
    const { ws, reconnect } = get();
    
    // Close existing connection if it exists
    if (ws) {
      ws.close();
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found for WebSocket');
        return;
      }
      
      // Create a new WebSocket connection
      const socketUrl = `${config.wsUrl}?token=${token}`;
      const newWs = new WebSocket(socketUrl);
      
      // Set up event handlers
      newWs.onopen = () => {
        console.log('WebSocket connection established');
        set({ 
          ws: newWs, 
          isConnected: true,
          isReconnecting: false,
          reconnectAttempts: 0
        });
      };
      
      newWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const chatStore = useChatStore.getState();
          
          // Handle new message from server
          if (data.type === 'message') {
            const { messages } = chatStore;
            const lastMessage = messages[messages.length - 1];
            
            // Only update if the last message is from the assistant
            if (lastMessage && lastMessage.role === 'assistant') {
              const updatedMessages = [...messages.slice(0, -1), {
                ...lastMessage,
                content: data.content || lastMessage.content,
                images: data.images || lastMessage.images || [],
                sources: data.sources || lastMessage.sources || [],
                isComplete: data.isComplete !== undefined ? data.isComplete : lastMessage.isComplete
              }];
              
              chatStore.setMessages(updatedMessages);
              
              // If this is the final message, update the loading state and fetch usage
              if (data.isComplete) {
                chatStore.setIsLoading(false);
                chatStore.fetchUsage();
              }
            }
          }
          
          // Handle chat ID assignment for new chats
          if (data.type === 'chatId' && data.chatId) {
            const chatId = data.chatId;
            chatStore.setCurrentChatId(chatId);
            
            // Update the URL to include the chat ID without reloading
            const currentUrl = new URL(window.location.href);
            const params = new URLSearchParams(currentUrl.search);
            params.set('chat', chatId);
            
            const newUrl = `${currentUrl.pathname}?${params.toString()}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
          }
          
          // Handle errors
          if (data.type === 'error') {
            console.error('WebSocket error:', data.message);
            
            // Add error message to chat
            const { messages } = chatStore;
            const lastMessage = messages[messages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              const updatedMessages = [...messages.slice(0, -1), {
                ...lastMessage,
                content: data.message || 'An error occurred',
                isComplete: true
              }];
              
              chatStore.setMessages(updatedMessages);
              chatStore.setIsLoading(false);
            }
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };
      
      newWs.onerror = (error) => {
        console.error('WebSocket error:', error);
        set({ isConnected: false });
      };
      
      newWs.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        set({ isConnected: false, ws: null });
        
        // Attempt to reconnect if not closing intentionally
        if (!event.wasClean) {
          reconnect();
        }
      };
      
      set({ ws: newWs });
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
    }
  },
  
  reconnect: () => {
    const { reconnectAttempts, isReconnecting, initializeWebSocket } = get();
    
    if (isReconnecting) return;
    
    if (reconnectAttempts < SOCKET_RECONNECT_ATTEMPTS) {
      set({ 
        isReconnecting: true,
        reconnectAttempts: reconnectAttempts + 1 
      });
      
      console.log(`Reconnecting WebSocket, attempt ${reconnectAttempts + 1}/${SOCKET_RECONNECT_ATTEMPTS}`);
      
      setTimeout(() => {
        initializeWebSocket();
        set({ isReconnecting: false });
      }, SOCKET_RECONNECT_DELAY);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
      set({ 
        isReconnecting: false,
        reconnectAttempts: 0
      });
    }
  },
  
  closeWebSocket: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },
  
  sendMessage: (messages, modelId, isImageGeneration, path, chatId) => {
    const { ws, isConnected } = get();
    const chatStore = useChatStore.getState();
    
    if (!ws || !isConnected) {
      console.error('WebSocket not connected, cannot send message');
      
      // Add error message to chat
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        const errorMessage: Message = {
          id: messages.length + 1,
          role: 'assistant',
          content: 'Error: Connection to server lost. Please try again.',
          timestamp: {
            $date: new Date().toISOString()
          },
          isComplete: true
        };
        
        chatStore.setMessages([...messages, errorMessage]);
        chatStore.setIsLoading(false);
      }
      
      return;
    }
    
    // Create message payload
    const messagePayload = {
      messages,
      modelId,
      isImageGeneration,
      path,
      chatId
    };
    
    // Send the message
    ws.send(JSON.stringify(messagePayload));
  }
}));

export default useChatWebSocketStore; 