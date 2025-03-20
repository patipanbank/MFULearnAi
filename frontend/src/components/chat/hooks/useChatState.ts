import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { config } from '../../../config/config';
import { ChatHistory, Message, Model, Usage } from '../utils/types';
import { isValidObjectId } from '../utils/formatters';

const useChatState = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImageGenerationMode, setIsImageGenerationMode] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Fetch available models - memoized to prevent unnecessary refetches
  const fetchModels = useCallback(async () => {
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

      setModels(allModels);

      // Set default model only if not already set
      if (allModels.length > 0 && !selectedModel) {
        const defaultModel = allModels.find((model: any) => model.name === 'Default') || allModels[0];
        setSelectedModel(defaultModel.id);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      if (error instanceof Error) {
        alert(error.message);
      }
      setModels([]);
    }
  }, [selectedModel]);

  // Load models on initial mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Load chat history when URL changes
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const chatId = urlParams.get('chat');
        
        if (!chatId) {
          setIsInitialLoad(false);
          return;
        }

        if (!isValidObjectId(chatId)) {
          console.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
          navigate('/mfuchatbot', { replace: true });
          return;
        }

        const token = localStorage.getItem('auth_token');
        if (!token) {
          navigate('/login');
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
          setCurrentChatId(chatIdString);
          
          if (chat.modelId) {
            setSelectedModel(chat.modelId);
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
            setMessages(processedMessages);
          }
        } else {
          const errorData = await response.text();
          console.error('Failed to load chat:', errorData);
          navigate('/mfuchatbot', { replace: true });
        }
        
        setIsInitialLoad(false);
      } catch (error) {
        console.error('Error loading chat history:', error);
        navigate('/mfuchatbot', { replace: true });
        setIsInitialLoad(false);
      }
    };

    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');

    if (chatId) {
      loadChatHistory();
    } else {
      // Reset state for new chat but keep selected model
      setMessages([]);
      setCurrentChatId(null);
      setInputMessage('');
      setSelectedImages([]);
      setSelectedFiles([]);
      setIsImageGenerationMode(false);
      
      // If no model is selected, set default model
      if (!selectedModel && models.length > 0) {
        const defaultModel = models.find(model => model.name === 'Default');
        setSelectedModel(defaultModel?.id || models[0].id);
      }
      
      setIsInitialLoad(false);
    }
  }, [location.search, models, navigate, selectedModel]);

  // Function to fetch usage - memoized to prevent unnecessary recreations
  const fetchUsage = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      const response = await fetch(`${config.apiUrl}/api/chat/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  }, []);

  // Check usage when component mounts
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Function to create a new empty chat
  const createNewChat = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
    setInputMessage('');
    setSelectedImages([]);
    setSelectedFiles([]);
    setIsImageGenerationMode(false);
    navigate('/mfuchatbot', { replace: true });
  }, [navigate]);

  return {
    messages,
    setMessages,
    inputMessage, 
    setInputMessage,
    isLoading,
    setIsLoading,
    isImageGenerationMode,
    setIsImageGenerationMode,
    currentChatId,
    setCurrentChatId,
    isMobile,
    models,
    selectedModel,
    setSelectedModel,
    selectedImages,
    setSelectedImages,
    usage,
    selectedFiles,
    setSelectedFiles,
    fetchUsage,
    createNewChat,
    isInitialLoad
  };
};

export default useChatState;