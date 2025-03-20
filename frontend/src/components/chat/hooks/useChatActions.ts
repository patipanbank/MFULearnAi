import { useCallback, useRef } from 'react';
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
  const processingRequestRef = useRef(false);

  // Prepare message for submission
  const prepareMessage = useCallback(async (content: string, isUserMessage: boolean = true) => {
    // Process files if any
    const messageFiles = selectedFiles.length > 0 
      ? await prepareMessageFiles(selectedFiles)
      : undefined;
    
    // Process images if any
    let messageImages: { data: string; mediaType: string }[] = [];
    if (selectedImages.length > 0) {
      messageImages = await Promise.all(selectedImages.map(async (file) => await compressImage(file)));
    }
    
    return {
      id: messages.length + (isUserMessage ? 1 : 2),
      role: isUserMessage ? 'user' : 'assistant',
      content: content,
      timestamp: { $date: new Date().toISOString() },
      files: isUserMessage ? messageFiles : undefined,
      images: isUserMessage && messageImages.length > 0 ? messageImages : [],
      sources: [],
      isImageGeneration: isImageGenerationMode,
      isComplete: isUserMessage ? true : false
    } as Message;
  }, [messages.length, selectedFiles, selectedImages, isImageGenerationMode]);

  // Send message to server via WebSocket
  const sendMessageToServer = useCallback((updatedMessages: Message[], _ontinuationMode: boolean = false) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const messagePayload = {
      messages: updatedMessages,
      modelId: selectedModel,
      isImageGeneration: isImageGenerationMode,
      path: location.pathname,
      chatId: currentChatId
    };

    wsRef.current.send(JSON.stringify(messagePayload));
  }, [wsRef, selectedModel, isImageGenerationMode, location.pathname, currentChatId]);

  // Handle submit function
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple simultaneous submissions
    if (processingRequestRef.current) return;
    if (!inputMessage.trim() && !isImageGenerationMode) return;
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }

    processingRequestRef.current = true;

    // Re-enable auto-scrolling when sending a new message, but respect user's reading state
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef.current) {
        throw new Error('Not authenticated or WebSocket not connected');
      }
      
      // Create and add user message
      const newMessage = await prepareMessage(inputMessage, true);
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);

      // Add placeholder for AI response
      const assistantMessage = await prepareMessage('', false);
      setMessages([...updatedMessages, assistantMessage]);

      // Send message to WebSocket
      sendMessageToServer(updatedMessages);

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
      processingRequestRef.current = false;
      setIsLoading(false);
      setInputMessage('');
      setSelectedImages([]);
      setSelectedFiles([]);
    }
  }, [
    inputMessage,
    isImageGenerationMode,
    selectedModel,
    userScrolledManually,
    setShouldAutoScroll,
    setIsLoading,
    messages,
    setMessages,
    prepareMessage,
    sendMessageToServer,
    fetchUsage,
    setInputMessage,
    setSelectedImages,
    setSelectedFiles,
    wsRef
  ]);

  // Function to handle "Continue" button click
  const handleContinueClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Prevent multiple simultaneous continuation requests
    if (processingRequestRef.current) return;
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }

    processingRequestRef.current = true;
    
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

      // Add placeholder for AI response
      const assistantMessage = await prepareMessage('', false);
      
      // Only add the assistant message to the UI
      setMessages([...messages, assistantMessage]);

      // Send message to WebSocket with both messages
      sendMessageToServer([...messages, continueMessage], true);

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
      processingRequestRef.current = false;
      setIsLoading(false);
    }
  }, [
    selectedModel,
    userScrolledManually,
    setShouldAutoScroll,
    setIsLoading,
    messages,
    prepareMessage,
    setMessages,
    sendMessageToServer,
    fetchUsage
  ]);

  // Handle key press events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isMobile) {
        return;
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          if (!processingRequestRef.current) {
            handleSubmit(e as unknown as React.FormEvent);
          }
        }
      }
    }
  }, [isMobile, handleSubmit]);

  // Handle paste events
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file && validateImageFile(file)) {
          e.preventDefault();
          setSelectedImages(prev => [...prev, file]);
        }
      }
    }
  }, [setSelectedImages]);

  const canSubmit = useCallback((): boolean => {
    // Can't submit if already processing a request
    if (processingRequestRef.current) return false;
    
    // Allow submit with empty content for image generation
    if (isImageGenerationMode) return true;
    
    // Need either text, images, or files to submit
    return (
      (inputMessage.trim().length > 0) || 
      selectedImages.length > 0 || 
      selectedFiles.length > 0
    );
  }, [inputMessage, selectedImages, selectedFiles, isImageGenerationMode]);

  return {
    handleSubmit,
    handleKeyDown,
    handlePaste,
    handleContinueClick,
    canSubmit
  };
};

export default useChatActions; 