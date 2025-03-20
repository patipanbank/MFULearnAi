import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { config } from '../../../config/config';
import { ChatHistory, Message, Model, Usage } from '../utils/types';
import { isValidObjectId } from '../utils/formatters';

// Add a logger utility
const logger = {
  log: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Chat] ${message}`, data || '');
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[Chat] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[Chat] ${message}`, data || '');
  }
};

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

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      logger.log('Fetching available models');
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          logger.error('No auth token found');
          return;
        }

        // Validate token format
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          logger.error('Invalid token format');
          return;
        }

        // Fetch models from API
        logger.log('Making API request to fetch models');
        const response = await fetch(`${config.apiUrl}/api/models`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(`Failed to fetch models: ${response.status}`, errorText);
          
          if (response.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
          }
          
          throw new Error(`Failed to fetch models: ${errorText}`);
        }

        const dbModels = await response.json();
        logger.log('Models fetched successfully', dbModels);
        
        // Transform model data
        const allModels = dbModels.map((model: any) => ({
          id: model._id,
          name: model.name,
          modelType: model.modelType
        }));

        setModels(allModels);

        // Set default model
        if (allModels.length > 0) {
          const defaultModel = allModels.find((model: any) => model.name === 'Default') || allModels[0];
          logger.log('Setting default model', defaultModel);
          setSelectedModel(defaultModel.id);
        }
      } catch (error) {
        logger.error('Error fetching models', error);
        if (error instanceof Error) {
          alert(error.message);
        }
        setModels([]);
      }
    };

    fetchModels();
  }, []);

  // Load chat history when URL changes
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const chatId = urlParams.get('chat');
        
        logger.log('Loading chat history', { chatId, pathname: location.pathname });
        
        if (!chatId) {
          logger.log('No chat ID in URL, starting new chat');
          // เมื่อไม่มี chatId ให้รีเซ็ต state ทั้งหมดยกเว้น selectedModel
          setMessages([]);
          setCurrentChatId(null);
          setInputMessage('');
          setSelectedImages([]);
          setSelectedFiles([]);
          setIsImageGenerationMode(false);
          
          // เมื่อไม่มี model ที่เลือก ให้รอจนกว่า models จะโหลดเสร็จแล้วเลือก default
          if (!selectedModel && models.length > 0) {
            const defaultModel = models.find(model => model.name === 'Default');
            logger.log('Setting default model from models list', { 
              defaultModel: defaultModel?.name, 
              modelId: defaultModel?.id
            });
            setSelectedModel(defaultModel?.id || models[0].id);
          }
          return;
        }

        if (!isValidObjectId(chatId)) {
          logger.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
          navigate('/mfuchatbot', { replace: true });
          return;
        }

        const token = localStorage.getItem('auth_token');
        if (!token) {
          logger.error('No auth token found while loading chat history');
          navigate('/login');
          return;
        }

        logger.log('Fetching chat history from API', { chatId });
        const response = await fetch(`${config.apiUrl}/api/chat/chats/${chatId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const chat: ChatHistory = await response.json();
          logger.log('Chat history loaded successfully', { 
            chatId: chat._id, 
            messageCount: chat.messages?.length || 0 
          });
          
          // Convert MongoDB ObjectId to string if necessary
          const chatIdString = typeof chat._id === 'string' ? chat._id : chat._id.$oid;
          setCurrentChatId(chatIdString);
          
          if (chat.modelId) {
            logger.log('Setting model from chat history', { modelId: chat.modelId });
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
            logger.log('Messages loaded and processed', { count: processedMessages.length });
          }
        } else {
          const errorData = await response.text();
          logger.error('Failed to load chat', errorData);
          // รีเซ็ต state เมื่อไม่สามารถโหลดแชทได้
          setMessages([]);
          setCurrentChatId(null);
          setInputMessage('');
          setSelectedImages([]);
          setSelectedFiles([]);
          navigate('/mfuchatbot', { replace: true });
        }
      } catch (error) {
        logger.error('Error loading chat history', error);
        // รีเซ็ต state เมื่อเกิดข้อผิดพลาด
        setMessages([]);
        setCurrentChatId(null);
        setInputMessage('');
        setSelectedImages([]);
        setSelectedFiles([]);
        navigate('/mfuchatbot', { replace: true });
      }
    };

    loadChatHistory();
  }, [location.search, models, navigate, selectedModel]);

  // Function to fetch usage
  const fetchUsage = async () => {
    try {
      logger.log('Fetching usage data');
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        logger.log('Usage data fetched successfully', data);
        setUsage(data);
      }
    } catch (error) {
      logger.error('Error fetching usage', error);
    }
  };

  // Check usage when component mounts
  useEffect(() => {
    fetchUsage();
  }, []);

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
    fetchUsage
  };
};

export default useChatState;