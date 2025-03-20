import { create } from 'zustand';
import { config } from '../config/config';
import { ChatHistory, Message, Model, Usage } from '../components/chat/utils/types';
import { isValidObjectId } from '../components/chat/utils/formatters';

interface ChatStateStore {
  messages: Message[];
  isLoading: boolean;
  currentChatId: string | null;
  isMobile: boolean;
  models: Model[];
  selectedModel: string;
  usage: Usage | null;
  
  // Actions
  setMessages: (messages: Message[]) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentChatId: (id: string | null) => void;
  setIsMobile: (isMobile: boolean) => void;
  setModels: (models: Model[]) => void;
  setSelectedModel: (modelId: string) => void;
  setUsage: (usage: Usage | null) => void;
  
  // API Actions
  fetchModels: () => Promise<void>;
  loadChatHistory: (chatId: string) => Promise<void>;
  fetchUsage: () => Promise<void>;
  resetState: () => void;
}

export const useChatStateStore = create<ChatStateStore>((set, get) => ({
  messages: [],
  isLoading: false,
  currentChatId: null,
  isMobile: false,
  models: [],
  selectedModel: '',
  usage: null,

  // Setters
  setMessages: (messages) => set({ messages }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setCurrentChatId: (id) => set({ currentChatId: id }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setModels: (models) => set({ models }),
  setSelectedModel: (modelId) => set({ selectedModel: modelId }),
  setUsage: (usage) => set({ usage }),

  // API Actions
  fetchModels: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      // Validate token format
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.error('Invalid token format');
        return;
      }

      // Fetch models from API
      const response = await fetch(`${config.apiUrl}/api/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch models:', response.status, errorText);
        
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          return;
        }
        
        throw new Error(`Failed to fetch models: ${errorText}`);
      }

      const dbModels = await response.json();
      
      // Transform model data
      const allModels = dbModels.map((model: any) => ({
        id: model._id,
        name: model.name,
        modelType: model.modelType
      }));

      set({ models: allModels });

      // Set default model
      if (allModels.length > 0) {
        const defaultModel = allModels.find((model: any) => model.name === 'Default') || allModels[0];
        set({ selectedModel: defaultModel.id });
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      if (error instanceof Error) {
        alert(error.message);
      }
      set({ models: [] });
    }
  },

  loadChatHistory: async (chatId: string) => {
    try {
      if (!isValidObjectId(chatId)) {
        console.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
        return;
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/chat/chats/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const chat: ChatHistory = await response.json();
        
        // Convert MongoDB ObjectId to string if necessary
        const chatIdString = typeof chat._id === 'string' ? chat._id : chat._id.$oid;
        
        if (chat.modelId) {
          set({ selectedModel: chat.modelId });
        }

        if (chat.messages && Array.isArray(chat.messages)) {
          const processedMessages = chat.messages.map((msg) => ({
            ...msg,
            timestamp: msg.timestamp,
            images: msg.images || [],
            sources: msg.sources || [],
            isImageGeneration: msg.isImageGeneration || false,
            isComplete: true
          }));
          set({ 
            messages: processedMessages,
            currentChatId: chatIdString
          });
        }
      } else {
        const errorData = await response.text();
        console.error('Failed to load chat:', errorData);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  },

  fetchUsage: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        set({ usage: data });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  },

  resetState: () => {
    const { models, selectedModel } = get();
    set({
      messages: [],
      currentChatId: null,
      usage: null
    });

    // If no model is selected, set default model
    if (!selectedModel && models.length > 0) {
      const defaultModel = models.find(model => model.name === 'Default');
      set({ selectedModel: defaultModel?.id || models[0].id });
    }
  }
})); 