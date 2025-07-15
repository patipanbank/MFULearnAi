import { create } from 'zustand';
import { api } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: Array<{ url: string; mediaType: string }>;
  isStreaming?: boolean;
  isComplete?: boolean;
  toolUsage?: Array<{
    type: 'tool_start' | 'tool_result' | 'tool_error';
    tool_name: string;
    tool_input?: string;
    output?: string;
    error?: string;
    timestamp: Date;
  }>;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
  isPinned?: boolean;
}

interface ChatState {
  // Current chat session
  currentSession: ChatSession | null;
  setCurrentSession: (session: ChatSession | null) => void;
  
  // Chat history
  chatHistory: ChatSession[];
  setChatHistory: (history: ChatSession[]) => void;
  addChatToHistory: (chat: ChatSession) => void;
  removeChatFromHistory: (chatId: string) => void;
  
  // Messages
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  
  // WebSocket state
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  setWsStatus: (status: ChatState['wsStatus']) => void;
  
  // Room management state
  isConnectedToRoom: boolean;
  setIsConnectedToRoom: (connected: boolean) => void;
  isRoomCreating: boolean;
  setIsRoomCreating: (creating: boolean) => void;
  
  // UI states
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Chat actions
  createNewChat: () => ChatSession;
  loadChat: (chatId: string) => Promise<boolean>;
  saveChat: () => Promise<void>;
  fetchChatHistory: (force?: boolean) => Promise<void>;
  deleteChat: (chatId: string) => Promise<boolean>;
  pinChat: (chatId: string, pinned: boolean) => void;
  updateChatName: (chatId: string, name: string) => Promise<ChatSession>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Current session
  currentSession: null,
  setCurrentSession: (session) => set({ currentSession: session }),
  
  // Chat history
  chatHistory: [],
  setChatHistory: (history) => set({ chatHistory: history }),
  addChatToHistory: (chat) => set((state) => ({
    chatHistory: [chat, ...state.chatHistory]
  })),
  removeChatFromHistory: (chatId) => set((state) => ({
    chatHistory: state.chatHistory.filter(chat => chat.id !== chatId)
  })),
  
  // Messages
  addMessage: (message) => {
    const state = get();
    if (!state.currentSession) return;
    let updatedName = state.currentSession.name;
    let shouldUpdateName = false;
    // เปลี่ยนชื่อแชทเฉพาะตอนแรกเท่านั้น
    if (
      (state.currentSession.name === 'New Chat' || !state.currentSession.name) &&
      message.role === 'user' &&
      state.currentSession.messages.length === 0
    ) {
      updatedName = message.content.slice(0, 20);
      shouldUpdateName = true;
    }
    const updatedSession = {
      ...state.currentSession,
      name: updatedName,
      messages: [...state.currentSession.messages, message],
      updatedAt: new Date()
    };
    set({ currentSession: updatedSession });
    // อัปเดตชื่อไป backend แค่ครั้งเดียว
    if (shouldUpdateName) {
      // Update chatHistory immediately
      set((prev) => ({
        chatHistory: prev.chatHistory.map(chat =>
          chat.id === state.currentSession!.id
            ? { ...chat, name: updatedName }
            : chat
        )
      }));
      
      // Make API call in background
      if (state.currentSession.id && state.currentSession.id.length === 24) {
        api.put(`/chat/${state.currentSession.id}/name`, {
          name: updatedName
        }).catch((e) => {
          console.error('Failed to update chat name:', e);
        });
      }
    }
  },
  
  updateMessage: (messageId, updates) => set((state) => {
    if (!state.currentSession) return state;
    
    const updatedMessages = state.currentSession.messages.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    
    return {
      currentSession: {
        ...state.currentSession,
        messages: updatedMessages
      }
    };
  }),
  
  clearMessages: () => set((state) => {
    if (!state.currentSession) return state;
    
    return {
      currentSession: {
        ...state.currentSession,
        messages: []
      }
    };
  }),
  
  // WebSocket state
  wsStatus: 'disconnected',
  setWsStatus: (status) => set({ wsStatus: status }),
  
  // Room management state
  isConnectedToRoom: false,
  setIsConnectedToRoom: (connected) => set({ isConnectedToRoom: connected }),
  isRoomCreating: false,
  setIsRoomCreating: (creating) => set({ isRoomCreating: creating }),
  
  // UI states
  isTyping: false,
  setIsTyping: (typing) => set({ isTyping: typing }),
  
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  // Actions
  createNewChat: () => {
    const newSession: ChatSession = {
      id: `chat_${Date.now()}`,
      name: 'New Chat',
      messages: [],
      agentId: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    set({ currentSession: newSession });
    return newSession;
  },
  
  // Load a specific chat by ID
  loadChat: async (chatId: string): Promise<boolean> => {
    try {
      const chat = await api.get<ChatSession>(`/chat/${chatId}`);
      const chatSession: ChatSession = {
        ...chat,
        id: chat.id,
        name: chat.name || 'New Chat',
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        messages: (chat.messages ?? []).map((msg: any) => {
          const ts = new Date(msg.timestamp);
          if (msg.role === 'assistant') ts.setHours(ts.getHours() + 7);
          return { ...msg, timestamp: ts };
        })
      };
      set({ currentSession: chatSession });
      return true;
    } catch (error) {
      console.error('Failed to load chat:', error);
      return false;
    }
  },
  
  saveChat: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      // API call now handles headers and token
      await api.post('/chat/save', currentSession);
      
      // Update chat history with saved chat
      const { chatHistory } = get();
      const existingIndex = chatHistory.findIndex(chat => chat.id === currentSession.id);
      
      if (existingIndex >= 0) {
        // Update existing chat
        const updatedHistory = [...chatHistory];
        updatedHistory[existingIndex] = currentSession;
        set({ chatHistory: updatedHistory });
      } else {
        // Add new chat to history
        set((state) => ({
          chatHistory: [currentSession, ...state.chatHistory]
        }));
      }
    } catch (error) {
      console.error('Failed to save chat:', error);
    }
  },
  
  // Fetch recent chats from backend
  fetchChatHistory: async (force = false) => {
    if (!force && get().chatHistory.length > 0) {
      return;
    }
    try {
      const response = await api.get<any>('/chat/history');
      const chats = response.data || []; // Access the data property from API response
      const chatSessions: ChatSession[] = chats
        .filter((c: any) => c.id && c.id.length === 24)
        .map((chat: any) => {
          // Find first user message if name is "New Chat"
          let chatName = chat.name || 'New Chat';
          if (chatName === 'New Chat' && chat.messages && chat.messages.length > 0) {
            const firstUserMessage = chat.messages.find((msg: any) => msg.role === 'user');
            if (firstUserMessage) {
              chatName = firstUserMessage.content.slice(0, 20);
            }
          }

          return {
            ...chat,
            id: chat.id,
            name: chatName,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt),
            messages: (chat.messages ?? []).map((msg: any) => {
              const ts = new Date(msg.timestamp);
              if (msg.role === 'assistant') ts.setHours(ts.getHours() + 7);
              return { ...msg, timestamp: ts };
            })
          };
        });
      set({ chatHistory: chatSessions });
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  },
  
  // Delete chat
  deleteChat: async (chatId: string): Promise<boolean> => {
    try {
      await api.delete(`/chat/${chatId}`);
      
      set((state) => ({
        chatHistory: state.chatHistory.filter(chat => chat.id !== chatId),
        currentSession: state.currentSession?.id === chatId ? null : state.currentSession
      }));
      return true;
    } catch (error) {
      console.error('Failed to delete chat:', error);
      return false;
    }
  },
  
  pinChat: async (chatId, pinned) => {
    try {
      // Update pin state in backend
      await api.post(`/chat/${chatId}/pin`, { isPinned: pinned });
      
      // Update local state
      set((state) => ({
        chatHistory: state.chatHistory.map(chat =>
          chat.id === chatId ? { ...chat, isPinned: pinned } : chat
        ),
        // Also update current session if it's the same chat
        currentSession: state.currentSession?.id === chatId 
          ? { ...state.currentSession, isPinned: pinned }
          : state.currentSession
      }));
    } catch (error) {
      console.error('Failed to pin chat:', error);
    }
  },

  // Update chat name
  updateChatName: async (chatId: string, name: string): Promise<ChatSession> => {
    try {
      const updatedChat = await api.put<ChatSession>(`/chat/${chatId}/name`, { name });
      set((state) => ({
        chatHistory: state.chatHistory.map(chat =>
          chat.id === chatId ? { ...chat, name } : chat
        ),
        currentSession: state.currentSession?.id === chatId
          ? { ...state.currentSession, name }
          : state.currentSession
      }));
      return updatedChat;
    } catch (error) {
      console.error('Failed to update chat name:', error);
      throw error;
    }
  }
}));

export default useChatStore; 