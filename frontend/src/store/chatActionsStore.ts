import { create } from 'zustand';
import { useRef, useEffect } from 'react';
import { useChatStore } from './chatStore';
import { Message } from '../components/chat/utils/types';
import { compressImage, prepareMessageFiles, validateImageFile } from '../components/chat/utils/fileProcessing';

interface ChatActionsState {
  textareaRef: React.RefObject<HTMLTextAreaElement> | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleContinueClick: (e: React.MouseEvent) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => Promise<void>;
  canSubmit: () => boolean;
  initializeTextareaRef: () => React.RefObject<HTMLTextAreaElement>;
}

export const useChatActionsStore = create<ChatActionsState>((set, get) => ({
  textareaRef: null,
  
  handleSubmit: async (e: React.FormEvent) => {
    e.preventDefault();
    
    const {
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
      setIsLoading,
      fetchUsage
    } = useChatStore.getState();
    
    if (!inputMessage.trim() && !isImageGenerationMode) return;
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }
    
    // Get WebSocket and scroll state from custom hooks
    // This is called from UI components so we need a way to connect these
    // In this case it uses data attributes on the event target to pass the values
    const eventTarget = e.currentTarget as HTMLElement;
    const userScrolledManually = eventTarget.dataset.userScrolledManually === 'true';
    const setShouldAutoScroll = (value: boolean) => {
      eventTarget.dispatchEvent(new CustomEvent('setShouldAutoScroll', { detail: value }));
    };
    const wsRef = {
      current: (window as any).currentWebSocket as WebSocket | null
    };
    
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
      const location = window.location;
      const messagePayload = {
        messages: updatedMessages,
        modelId: selectedModel,
        isImageGeneration: isImageGenerationMode,
        path: location.pathname,
        chatId: currentChatId
      };

      wsRef.current?.send(JSON.stringify(messagePayload));

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
  },
  
  handleContinueClick: async (e: React.MouseEvent) => {
    e.preventDefault();
    
    const {
      messages,
      setMessages,
      selectedModel,
      currentChatId,
      setIsLoading,
      fetchUsage
    } = useChatStore.getState();
    
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }
    
    // Get WebSocket and scroll state from custom hooks
    // This is called from UI components so we need a way to connect these
    const eventTarget = e.currentTarget as HTMLElement;
    const userScrolledManually = eventTarget.dataset.userScrolledManually === 'true';
    const setShouldAutoScroll = (value: boolean) => {
      eventTarget.dispatchEvent(new CustomEvent('setShouldAutoScroll', { detail: value }));
    };
    const wsRef = {
      current: (window as any).currentWebSocket as WebSocket | null
    };

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
      const location = window.location;
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
  },
  
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { isMobile } = useChatStore.getState();
    const { handleSubmit } = get();
    
    if (e.key === 'Enter') {
      if (isMobile) {
        return;
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          handleSubmit(e as unknown as React.FormEvent);
        }
      }
    }
  },
  
  handlePaste: async (e: React.ClipboardEvent) => {
    const { setSelectedImages } = useChatStore.getState();
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file && await validateImageFile(file)) {
          setSelectedImages(prev => [...prev, file]);
        }
      }
    }
  },
  
  canSubmit: (): boolean => {
    const { inputMessage, isImageGenerationMode, isLoading, selectedImages } = useChatStore.getState();
    
    if (isLoading) return false;
    
    if (isImageGenerationMode) {
      return true;
    } else {
      return inputMessage.trim().length > 0 || selectedImages.length > 0;
    }
  },
  
  initializeTextareaRef: () => {
    const ref = useRef<HTMLTextAreaElement>(null);
    set({ textareaRef: ref });
    return ref;
  }
}));

// Custom hook for component integration
export const useChatActions = () => {
  const {
    handleSubmit,
    handleContinueClick,
    handleKeyDown,
    handlePaste,
    canSubmit,
    initializeTextareaRef
  } = useChatActionsStore();
  
  const textareaRef = initializeTextareaRef();
  
  // Auto-resize textarea as user types
  const { inputMessage } = useChatStore();
  
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
  }, [inputMessage, textareaRef]);
  
  return {
    handleSubmit,
    handleContinueClick,
    handleKeyDown,
    handlePaste,
    canSubmit,
    textareaRef
  };
}; 