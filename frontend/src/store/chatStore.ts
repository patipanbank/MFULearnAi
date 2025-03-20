import { create } from 'zustand';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { config } from '../config/config';
import { ChatHistory, Message, Model, Usage } from '../components/chat/utils/types';
import { isValidObjectId } from '../components/chat/utils/formatters';

interface ChatState {
  // Chat messages and input
  messages: Message[];
  inputMessage: string;
  isLoading: boolean;
  isImageGenerationMode: boolean;
  currentChatId: string | null;
  
  // Media files
  selectedImages: File[];
  selectedFiles: File[];
  
  // Models
  models: Model[];
  selectedModel: string;
  
  // Usage information
  usage: Usage | null;
  
  // Device information
  isMobile: boolean;
  
  // Actions
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setInputMessage: (message: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsImageGenerationMode: (isImageGeneration: boolean) => void;
  setCurrentChatId: (chatId: string | null) => void;
  setSelectedImages: (images: File[] | ((prev: File[]) => File[])) => void;
  setSelectedFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  setSelectedModel: (modelId: string) => void;
  setUsage: (usage: Usage | null) => void;
  setIsMobile: (isMobile: boolean) => void;
  
  // Fetch operations
  fetchModels: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  loadChatHistory: (chatId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, _get) => ({
  // Initial state
  messages: [],
  inputMessage: '',
  isLoading: false,
  isImageGenerationMode: false,
  currentChatId: null,
  selectedImages: [],
  selectedFiles: [],
  models: [],
  selectedModel: '',
  usage: null,
  isMobile: false,
  
  // State setters
  setMessages: (messages) => set((state) => ({
    messages: typeof messages === 'function' ? messages(state.messages) : messages
  })),
  
  setInputMessage: (message) => set({ inputMessage: message }),
  
  setIsLoading: (isLoading) => set({ isLoading }),
  
  setIsImageGenerationMode: (isImageGeneration) => set({ isImageGenerationMode: isImageGeneration }),
  
  setCurrentChatId: (chatId) => set({ currentChatId: chatId }),
  
  setSelectedImages: (images) => set((state) => ({
    selectedImages: typeof images === 'function' ? images(state.selectedImages) : images
  })),
  
  setSelectedFiles: (files) => set((state) => ({
    selectedFiles: typeof files === 'function' ? files(state.selectedFiles) : files
  })),
  
  setSelectedModel: (modelId) => set({ selectedModel: modelId }),
  
  setUsage: (usage) => set({ usage }),
  
  setIsMobile: (isMobile) => set({ isMobile }),
  
  // Fetch operations
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
  
  loadChatHistory: async (chatId: string) => {
    try {
      if (!isValidObjectId(chatId)) {
        console.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
        window.location.href = '/mfuchatbot';
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
        set({ currentChatId: chatIdString });
        
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
          set({ messages: processedMessages });
        }
      } else {
        const errorData = await response.text();
        console.error('Failed to load chat:', errorData);
        window.location.href = '/mfuchatbot';
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      window.location.href = '/mfuchatbot';
    }
  }
}));

// Hook to initialize and manage the chat store based on route changes
export const useChatStoreInitializer = () => {
  const location = useLocation();
  const { 
    fetchModels, 
    fetchUsage, 
    loadChatHistory, 
    setMessages, 
    setCurrentChatId, 
    setIsMobile,
    setSelectedModel,
    models,
    selectedModel
  } = useChatStore();

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, [setIsMobile]);

  // Fetch models when component mounts
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Fetch usage when component mounts
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Handle URL changes to load chat history or reset for new chat
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');

    if (chatId) {
      loadChatHistory(chatId);
    } else {
      // Reset state for new chat but keep selected model
      setMessages([]);
      setCurrentChatId(null);
      
      // If no model is selected, set default model
      if (!selectedModel && models.length > 0) {
        const defaultModel = models.find(model => model.name === 'Default');
        setSelectedModel(defaultModel?.id || models[0].id);
      }
    }
  }, [location.search, models, selectedModel, loadChatHistory, setMessages, setCurrentChatId, setSelectedModel]);
}; 