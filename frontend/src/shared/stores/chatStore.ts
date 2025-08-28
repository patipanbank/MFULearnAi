import { create } from 'zustand';

export interface ChatState {
  chatHistory: any[];
  currentSession: any;
  loading: boolean;
  isTyping: boolean;
  wsStatus: string;
  isConnectedToRoom: boolean;
  
  // Actions
  addMessage: (message: any) => void;
  updateMessage: (id: string, updates: any) => void;
  setChatHistory: (history: any[]) => void;
  fetchChatHistory: () => void;
  loadChat: (id: string) => void;
  deleteChat: (id: string) => void;
  pinChat: (id: string) => void;
  createNewChat: () => void;
  setIsTyping: (typing: boolean) => void;
  setIsRoomCreating: (creating: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chatHistory: [],
  currentSession: null,
  loading: false,
  isTyping: false,
  wsStatus: 'disconnected',
  isConnectedToRoom: false,
  
  addMessage: (message) => {
    set((state) => ({ 
      chatHistory: [...state.chatHistory, message] 
    }));
  },
  
  updateMessage: (id, updates) => {
    set((state) => ({
      chatHistory: state.chatHistory.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    }));
  },
  
  setChatHistory: (history) => set({ chatHistory: history }),
  
  fetchChatHistory: () => {
    // Placeholder implementation
  },
  
  loadChat: (id) => {
    // Placeholder implementation
  },
  
  deleteChat: (id) => {
    // Placeholder implementation
  },
  
  pinChat: (id) => {
    // Placeholder implementation
  },
  
  createNewChat: () => {
    // Placeholder implementation
  },
  
  setIsTyping: (typing) => set({ isTyping: typing }),
  
  setIsRoomCreating: (creating) => {
    // Placeholder implementation
  }
}));