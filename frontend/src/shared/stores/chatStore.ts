import { create } from 'zustand';
import { api } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: Array<{ data: string; mediaType: string }>;
  isStreaming?: boolean;
  isComplete?: boolean;
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
  
  // UI states
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Chat actions
  createNewChat: () => ChatSession;
  loadChat: (chatId: string) => Promise<void>;
  saveChat: () => Promise<void>;
  fetchChatHistory: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  pinChat: (chatId: string, pinned: boolean) => void;
  
  // เพิ่ม property error
  error: string | null;
}

const useChatStore = create<ChatState>((set, get) => ({
  // Current chat session
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
  addMessage: (message) => set((state) => {
    if (!state.currentSession) return state;
    
    const updatedSession = {
      ...state.currentSession,
      messages: [...state.currentSession.messages, message],
      updatedAt: new Date()
    };
    
    return {
      currentSession: updatedSession
    };
  }),
  
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
  
  loadChat: async (chatId: string) => {
    set({ isLoading: true });
    try {
      const response = await api.get<any>(`/chat/history/${chatId}`);
      
      if (response.success && response.data) {
        // Convert date strings back to Date objects
        const chatSession: ChatSession = {
          ...response.data,
          createdAt: new Date(response.data.createdAt),
          updatedAt: new Date(response.data.updatedAt),
          messages: (response.data.messages || []).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        };
        set({ currentSession: chatSession });
      } else {
        throw new Error('Failed to load chat');
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  saveChat: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      const response = await api.post<any>('/chat/save', currentSession);
      
      if (response.success) {
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
      }
    } catch (error) {
      console.error('Failed to save chat:', error);
    }
  },
  
  // Fetch recent chats from backend
  fetchChatHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<any>('/chat/history');
      
      if (response.success && Array.isArray(response.data)) {
        const history: ChatSession[] = response.data
          .map((chat: any) => {
            if (!chat.id) {
              console.warn('Chat session from API is missing an ID, skipping.', chat);
              return null;
            }
            return {
              ...chat,
              messages: [], // We don't load all messages for the history view
              createdAt: new Date(chat.createdAt),
              updatedAt: new Date(chat.updatedAt),
            };
          })
          .filter((chat): chat is ChatSession => chat !== null);

        set({ 
          chatHistory: history,
          isLoading: false
        });
      } else {
        console.error('Failed to fetch chat history:', response.error || 'Response data is not an array');
        set({ 
          error: 'Failed to fetch chat history',
          isLoading: false,
          chatHistory: [] // Reset history on failure
        });
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
      set({ 
        error: 'Error fetching chat history',
        isLoading: false
      });
    }
  },
  
  // Delete chat
  deleteChat: async (chatId: string) => {
    try {
      const response = await api.delete<any>(`/chat/${chatId}`);
      
      if (response.success) {
        set((state) => ({
          chatHistory: state.chatHistory.filter(chat => chat.id !== chatId),
          currentSession: state.currentSession?.id === chatId ? null : state.currentSession
        }));
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  },
  
  pinChat: (chatId, pinned) => set((state) => ({
    chatHistory: state.chatHistory.map(chat =>
      chat.id === chatId ? { ...chat, isPinned: pinned } : chat
    )
  })),
  
  // เพิ่ม property error
  error: null,
}));

export default useChatStore; 