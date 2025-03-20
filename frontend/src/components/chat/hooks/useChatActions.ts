import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Message } from '../utils/types';
import { compressImage, prepareMessageFiles, validateImageFile } from '../utils/fileProcessing';

// Add a logger utility
const logger = {
  log: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ChatActions] ${message}`, data || '');
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[ChatActions] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[ChatActions] ${message}`, data || '');
  }
};

interface UseChatActionsProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  inputMessage: string;
  setInputMessage: React.Dispatch<React.SetStateAction<string>>;
  selectedImages: File[];
  setSelectedImages: React.Dispatch<React.SetStateAction<File[]>>;
  selectedFiles: File[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  selectedModel: string;
  isImageGenerationMode: boolean;
  currentChatId: string | null;
  wsRef: React.MutableRefObject<WebSocket | null>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  userScrolledManually: boolean;
  setShouldAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
  fetchUsage: () => Promise<void>;
}

const useChatActions = ({
  messages,
  setMessages,
  inputMessage,
  setInputMessage,
  selectedImages,
  setSelectedImages,
  selectedFiles,
  setSelectedFiles,
  selectedModel,
  isImageGenerationMode,
  currentChatId,
  wsRef,
  setIsLoading,
  isMobile,
  userScrolledManually,
  setShouldAutoScroll,
  fetchUsage
}: UseChatActionsProps) => {
  const location = useLocation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    const autoResize = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        const lineHeight = 24;
        const maxLines = 5;
        const maxHeight = lineHeight * maxLines;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
      }
    };
    autoResize();
  }, [inputMessage]);

  // Handle submit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() && !isImageGenerationMode) return;
    if (!selectedModel) {
      logger.error('No model selected when attempting to submit message');
      alert('Please select a model first');
      return;
    }

    logger.log('Message submission started', { 
      hasText: !!inputMessage.trim(), 
      imageMode: isImageGenerationMode,
      imageCount: selectedImages.length,
      fileCount: selectedFiles.length,
      modelId: selectedModel,
      chatId: currentChatId
    });

    // Re-enable auto-scrolling when sending a new message, but respect user's reading state
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef.current) {
        logger.error('Not authenticated or WebSocket not connected');
        throw new Error('Not authenticated or WebSocket not connected');
      }
      
      // ตรวจสอบสถานะการเชื่อมต่อ WebSocket
      if (wsRef.current.readyState !== WebSocket.OPEN) {
        logger.error('WebSocket connection not open', { readyState: wsRef.current.readyState });
        throw new Error('WebSocket connection not open');
      }
      
      // Process files if any
      let messageFiles;
      if (selectedFiles.length > 0) {
        logger.log('Processing files for upload', { count: selectedFiles.length });
        messageFiles = await prepareMessageFiles(selectedFiles);
      }
      
      // Process images if any
      let messageImages: { data: string; mediaType: string }[] = [];
      if (selectedImages.length > 0) {
        logger.log('Processing images for upload', { count: selectedImages.length });
        messageImages = await Promise.all(selectedImages.map(async (file) => await compressImage(file)));
      }
      
      const newMessage: Message = {
        id: messages.length + 1,
        role: 'user',
        content: inputMessage,
        timestamp: { $date: new Date().toISOString() },
        files: messageFiles,
        images: messageImages.length > 0 ? messageImages : undefined
      };

      // Add user message to state
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      logger.log('User message added to state');

      // Add placeholder for AI response
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: '',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: isImageGenerationMode,
        isComplete: false
      };
      setMessages([...updatedMessages, assistantMessage]);
      logger.log('Assistant placeholder message added');

      // Send message to WebSocket
      const messagePayload = {
        messages: updatedMessages,
        modelId: selectedModel,
        isImageGeneration: isImageGenerationMode,
        path: location.pathname,
        chatId: currentChatId
      };

      logger.log('Sending message payload to WebSocket');
      wsRef.current?.send(JSON.stringify(messagePayload));

      // Update usage immediately after sending message
      await fetchUsage();
      logger.log('Message submission completed');

    } catch (error) {
      logger.error('Error in handleSubmit', error);
      setMessages(prev => [...prev.slice(0, -1), {
        id: messages.length + 2,
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false,
        isComplete: true
      }]);
    } finally {
      setIsLoading(false);
      setInputMessage('');
      setSelectedImages([]);
      setSelectedFiles([]);
    }
  };

  // Function to handle "Continue" button click
  const handleContinueClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedModel) {
      logger.error('No model selected when attempting to continue conversation');
      alert('Please select a model first');
      return;
    }

    logger.log('Continue conversation started', { 
      modelId: selectedModel,
      chatId: currentChatId
    });

    // Re-enable auto-scrolling when continuing the conversation, but respect user's reading position
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef.current) {
        logger.error('Not authenticated or WebSocket not connected for continue');
        throw new Error('Not authenticated or WebSocket not connected');
      }

      // Creating a temporary message that won't be displayed
      const continueMessage: Message = {
        id: messages.length + 1,
        role: 'user',
        content: "Continue writing",
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false
      };

      // Add placeholder for AI response without showing the user message
      const assistantMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: '',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false,
        isComplete: false
      };
      
      // Only add the assistant message to the UI
      setMessages([...messages, assistantMessage]);
      logger.log('Assistant placeholder added for continue');

      // Send message to WebSocket with both messages
      const messagePayload = {
        messages: [...messages, continueMessage],
        modelId: selectedModel,
        isImageGeneration: false,
        path: location.pathname,
        chatId: currentChatId
      };

      logger.log('Sending continue payload to WebSocket');
      wsRef.current?.send(JSON.stringify(messagePayload));

      // Update usage after sending the message
      fetchUsage();
      logger.log('Continue request completed');

    } catch (error) {
      logger.error('Error in handleContinueClick', error);
      setMessages(prev => [...prev.slice(0, -1), {
        id: messages.length + 2,
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred',
        timestamp: {
          $date: new Date().toISOString()
        },
        images: [],
        sources: [],
        isImageGeneration: false,
        isComplete: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey && !isMobile) {
        e.preventDefault();
        if (canSubmit()) {
          handleSubmit(e);
        }
      }
    }
  };

  // Handle paste events
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    logger.log('Paste event detected');
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          try {
            await validateImageFile(file);
            setSelectedImages(prev => [...prev, file]);
            logger.log('Image pasted and added', { filename: file.name, type: file.type });
          } catch (error) {
            logger.error('Image validation failed on paste', error);
            alert(error instanceof Error ? error.message : 'Invalid image');
          }
        }
      }
    }
  };

  // Check if the user can submit a message
  const canSubmit = (): boolean => {
    if (isImageGenerationMode) {
      return true;
    }
    return !!inputMessage.trim();
  };

  return {
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    canSubmit,
    textareaRef
  };
};

export default useChatActions; 