import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { config } from '../../../config/config';
import { ChatHistory, Message, Model, Usage } from '../utils/types';
import { isValidObjectId } from '../utils/formatters';
import useChatStore from '../../../store/chatStore';

const useChatState = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get states from zustand store instead of creating local states
  const {
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
    setIsMobile,
    models,
    setModels,
    selectedModel,
    setSelectedModel,
    selectedImages,
    setSelectedImages,
    selectedFiles,
    setSelectedFiles,
    usage,
    setUsage,
    isLoadingChat,
    setIsLoadingChat
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

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
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

        // Set default model
        if (allModels.length > 0) {
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
    };

    fetchModels();
  }, []);

  // Load chat history when URL changes
  useEffect(() => {
    const loadChatHistory = async () => {
      setIsLoadingChat(true);
      try {
        const urlParams = new URLSearchParams(location.search);
        const chatId = urlParams.get('chat');
        
        if (!chatId) {
          console.log('No chat ID in URL');
          setIsLoadingChat(false);
          return;
        }

        if (!isValidObjectId(chatId)) {
          console.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
          setIsLoadingChat(false);
          navigate('/mfuchatbot', { replace: true });
          return;
        }

        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.error('No auth token found, redirecting to login');
          setIsLoadingChat(false);
          navigate('/login');
          return;
        }

        console.log(`Fetching chat history for ID: ${chatId}`);
        
        // Check network first
        try {
          await fetch(`${config.apiUrl}/api/health`, { 
            method: 'HEAD',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (networkError) {
          console.error('Network error checking API health:', networkError);
          setIsLoadingChat(false);
          // Don't redirect, just show an error message
          alert('Network error: Cannot connect to server. Please check your connection.');
          return;
        }

        const response = await fetch(`${config.apiUrl}/api/chat/chats/${chatId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const chat = await response.json();
          console.log('Chat data received:', chat);
          
          // Convert MongoDB ObjectId to string if necessary
          const chatIdString = typeof chat._id === 'string' ? chat._id : chat._id.$oid;
          setCurrentChatId(chatIdString);
          
          if (chat.modelId) {
            setSelectedModel(chat.modelId);
          }

          if (chat.messages && Array.isArray(chat.messages)) {
            const processedMessages = chat.messages.map((msg: any) => ({
              ...msg,
              timestamp: msg.timestamp,
              images: msg.images || [],
              sources: msg.sources || [],
              isImageGeneration: msg.isImageGeneration || false,
              isComplete: true
            }));
            setMessages(processedMessages);
            console.log(`Loaded ${processedMessages.length} messages`);
          } else {
            console.error('Chat has no messages or invalid message format:', chat);
            alert('This chat has no messages or the format is invalid');
          }
          setIsLoadingChat(false);
        } else {
          const status = response.status;
          const errorData = await response.text();
          console.error(`Failed to load chat (${status}):`, errorData);
          setIsLoadingChat(false);
          
          if (status === 401 || status === 403) {
            alert(`Authentication error: ${errorData}`);
            navigate('/login');
          } else if (status === 404) {
            alert(`Chat not found. The chat might have been deleted.`);
            navigate('/mfuchatbot', { replace: true });
          } else {
            alert(`Error loading chat: ${errorData}`);
            // Don't redirect automatically on server errors
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        setIsLoadingChat(false);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Don't redirect automatically on errors
      }
    };

    const urlParams = new URLSearchParams(location.search);
    const chatId = urlParams.get('chat');

    if (chatId) {
      loadChatHistory();
    } else {
      setIsLoadingChat(false);
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
    }
  }, [location.search, models, navigate, setMessages, setCurrentChatId, setInputMessage, 
      setSelectedImages, setSelectedFiles, setIsImageGenerationMode, setSelectedModel, setIsLoadingChat]);

  // Function to fetch usage
  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('auth_token');
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
    fetchUsage,
    isLoadingChat,
    setIsLoadingChat
  };
};

export default useChatState;