import {create} from 'zustand';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
}

const useChatStore = create<ChatState>((set) => ({
  messages: [
    { id: '1', text: 'Hello! How can I help you today?', sender: 'bot', timestamp: new Date() }
  ],
  isLoading: false,
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

export default useChatStore; 