import { create } from 'zustand';
import { api } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  images?: Array<{ url: string; mediaType: string }>;
  isStreaming?: boolean;
  isComplete?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  userId: string;
  messages: ChatMessage[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  agentId?: string;
  modelId?: string;
}

interface ChatState {
  chatHistory: Chat[];
  currentSession: Chat | null;
  isLoading: boolean;
  wsStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  isTyping: boolean;
  setWsStatus: (status: ChatState['wsStatus']) => void;
  loadChat: (chatId: string) => Promise<boolean>;
  fetchChatHistory: () => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  updateMessageById: (id: string, newMessage: ChatMessage) => void;
  createNewChat: () => void;
  setCurrentSession: (session: Chat | null) => void;
  setChatHistory: (history: Chat[]) => void;
  setIsTyping: (isTyping: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  deleteChat: (chatId: string) => Promise<void>;
  pinChat: (chatId: string, pinned: boolean) => void;
  removeChatFromHistory: (chatId: string) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  chatHistory: [],
  currentSession: null,
  isLoading: false,
  wsStatus: 'disconnected',
  isTyping: false,
  setWsStatus: (status) => set({ wsStatus: status }),
  setLoading: (isLoading) => set({ isLoading }),
  setIsTyping: (isTyping) => set({ isTyping }),
  loadChat: async (chatId) => {
    set({ isLoading: true });
    try {
      const data = await api.get<Chat>(`/chat/history/${chatId}`);
      const messages = data.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      set({ currentSession: { ...data, messages }, isLoading: false });
      return true;
    } catch (error) {
      console.error('Failed to load chat:', error);
      set({ isLoading: false });
      return false;
    }
  },
  fetchChatHistory: async () => {
    set({ isLoading: true });
    try {
      const history = await api.get<Chat[]>('/chat/history');
      set({ chatHistory: history, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      set({ isLoading: false });
    }
  },
  addMessage: (message) => {
    set((state) => {
      if (!state.currentSession) return state;
      const newMessages = [...state.currentSession.messages, message];
      // Ensure no duplicate messages by id
      const uniqueMessages = Array.from(new Map(newMessages.map(m => [m.id, m])).values());
      return {
        currentSession: {
          ...state.currentSession,
          messages: uniqueMessages,
        },
      };
    });
  },
  updateMessage: (id, updates) => {
    set((state) => {
      if (!state.currentSession) return state;
      const updatedMessages = state.currentSession.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      );
      return {
        currentSession: { ...state.currentSession, messages: updatedMessages },
      };
    });
  },
  updateMessageById: (id, newMessage) => {
    set((state) => {
      if (!state.currentSession) return state;
      const updatedMessages = state.currentSession.messages.map((msg) =>
        msg.id === id ? newMessage : msg
      );
      return {
        currentSession: { ...state.currentSession, messages: updatedMessages },
      };
    });
  },
  createNewChat: () => {
    const newChat: Chat = {
      id: `temp_${Date.now()}`,
      name: 'New Chat',
      userId: '',
      messages: [],
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({ currentSession: newChat });
  },
  setCurrentSession: (session) => {
    set({ currentSession: session });
  },
  setChatHistory: (history) => {
    set({ chatHistory: history });
  },
  removeChatFromHistory: (chatId) => {
    set((state) => ({
      chatHistory: state.chatHistory.filter((chat) => chat.id !== chatId),
    }));
  },
  deleteChat: async (chatId) => {
    const { removeChatFromHistory, currentSession, setCurrentSession, fetchChatHistory } = get();
    try {
      await api.delete(`/chat/${chatId}`);
      removeChatFromHistory(chatId);
      if (currentSession?.id === chatId) {
        setCurrentSession(null);
      }
      // a temporary solution to update chat history after deletion
      fetchChatHistory();
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  },
  pinChat: (chatId, pinned) => {
    set((state) => ({
      chatHistory: state.chatHistory.map((chat) =>
        chat.id === chatId ? { ...chat, isPinned: pinned } : chat
      ),
    }));
  },
}));

export default useChatStore; 