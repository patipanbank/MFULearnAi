import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Message } from '../utils/types';
import { compressImage, prepareMessageFiles, validateImageFile } from '../utils/fileProcessing';

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timeout when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
      alert('Please select a model first');
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Re-enable auto-scrolling when sending a new message, but respect user's reading state
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Check WebSocket connection
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('WebSocket not connected, reconnecting...');
        const wsUrl = new URL(import.meta.env.VITE_WS_URL);
        wsUrl.searchParams.append('token', token);
        if (currentChatId) {
          wsUrl.searchParams.append('chat', currentChatId);
        }
        wsRef.current = new WebSocket(wsUrl.toString());
        
        // Wait for connection to open
        await new Promise((resolve, reject) => {
          const connectTimeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
          wsRef.current!.onopen = () => {
            clearTimeout(connectTimeout);
            resolve(true);
          };
          wsRef.current!.onerror = (error) => {
            clearTimeout(connectTimeout);
            reject(error);
          };
        });
      }
      
      // Process files if any
      const messageFiles = selectedFiles.length > 0 
        ? await prepareMessageFiles(selectedFiles)
        : undefined;
      
      // Process images if any
      let messageImages: { data: string; mediaType: string }[] = [];
      if (selectedImages.length > 0) {
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

      // Send message to WebSocket
      const messagePayload = {
        messages: updatedMessages,
        modelId: selectedModel,
        isImageGeneration: isImageGenerationMode,
        path: location.pathname,
        chatId: currentChatId
      };

      wsRef.current.send(JSON.stringify(messagePayload));

      // Set a timeout to handle potential response timeout
      timeoutRef.current = setTimeout(() => {
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage.role === 'assistant' && !lastMessage.isComplete) {
            return [...prev.slice(0, -1), {
              ...lastMessage,
              content: lastMessage.content || 'No response received. The server might be busy. Please try again.',
              isComplete: true
            }];
          }
          return prev;
        });
        setIsLoading(false);
      }, 60000); // 60 seconds timeout

      // Update usage immediately after sending message
      await fetchUsage();

    } catch (error) {
      console.error('Error in handleSubmit:', error);
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
      alert('Please select a model first');
      return;
    }

    // Re-enable auto-scrolling when continuing the conversation, but respect user's reading position
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef.current) {
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

      // Send message to WebSocket with both messages
      const messagePayload = {
        messages: [...messages, continueMessage],
        modelId: selectedModel,
        isImageGeneration: false,
        path: location.pathname,
        chatId: currentChatId
      };

      wsRef.current?.send(JSON.stringify(messagePayload));

      // Update usage after sending the message
      fetchUsage();

    } catch (error) {
      console.error('Error in handleContinueClick:', error);
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
      if (isMobile) {
        return;
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          handleSubmit(e);
        }
      }
    }
  };

  // Handle paste events to detect image pasting
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file && validateImageFile(file)) {
            setSelectedImages(prev => [...prev, file]);
          }
          break;
        }
      }
    }
  };

  // Check if the submit button should be enabled
  const canSubmit = (): boolean => {
    const hasText = inputMessage.trim().length > 0;
    const hasFiles = selectedFiles.length > 0;
    const hasImages = selectedImages.length > 0;
    const hasModel = selectedModel !== '';
    
    return (hasText || hasFiles || hasImages) && hasModel && !location.pathname.includes('/chat');
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