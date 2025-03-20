import { create } from 'zustand';
import { Message } from '../components/chat/utils/types';
import { compressImage, prepareMessageFiles } from '../components/chat/utils/fileProcessing';
import { useChatStateStore } from './chatStateStore';
import { useChatInputStore } from './chatInputStore';

interface ChatActionsStore {
  wsRef: WebSocket | null;
  userScrolledManually: boolean;
  shouldAutoScroll: boolean;
  
  // Actions
  setWsRef: (ws: WebSocket | null) => void;
  setUserScrolledManually: (scrolled: boolean) => void;
  setShouldAutoScroll: (should: boolean) => void;
  
  // Chat Actions
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleContinueClick: (e: React.MouseEvent) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => Promise<void>;
  canSubmit: () => boolean;
}

export const useChatActionsStore = create<ChatActionsStore>((set, get) => ({
  wsRef: null,
  userScrolledManually: false,
  shouldAutoScroll: true,

  // Setters
  setWsRef: (ws) => set({ wsRef: ws }),
  setUserScrolledManually: (scrolled) => set({ userScrolledManually: scrolled }),
  setShouldAutoScroll: (should) => set({ shouldAutoScroll: should }),

  // Chat Actions
  handleSubmit: async (e: React.FormEvent) => {
    e.preventDefault();
    
    const {
      inputMessage,
      selectedImages,
      selectedFiles,
      isImageGenerationMode,
      setInputMessage,
      setSelectedImages,
      setSelectedFiles
    } = useChatInputStore.getState();

    const {
      messages,
      selectedModel,
      currentChatId,
      setMessages,
      setIsLoading,
      fetchUsage
    } = useChatStateStore.getState();

    const { wsRef, userScrolledManually, setShouldAutoScroll } = get();

    if (!inputMessage.trim() && !isImageGenerationMode) return;
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }

    // Re-enable auto-scrolling when sending a new message, but respect user's reading state
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
    }
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef) {
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
      const messagePayload = {
        messages: updatedMessages,
        modelId: selectedModel,
        isImageGeneration: isImageGenerationMode,
        path: window.location.pathname,
        chatId: currentChatId
      };

      wsRef.send(JSON.stringify(messagePayload));

      // Update usage immediately after sending message
      await fetchUsage();

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const errorMessage: Message = {
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
      };
      const updatedMessages = [...messages.slice(0, -1), errorMessage];
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
      setInputMessage('');
      setSelectedImages([]);
      setSelectedFiles([]);
    }
  },

  handleContinueClick: async (e: React.MouseEvent) => {
    e.preventDefault();
    
    const { selectedModel } = useChatInputStore.getState();
    const {
      messages,
      currentChatId,
      setMessages,
      setIsLoading,
      fetchUsage
    } = useChatStateStore.getState();

    const { wsRef, userScrolledManually, setShouldAutoScroll } = get();

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
      if (!token || !wsRef) {
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
        path: window.location.pathname,
        chatId: currentChatId
      };

      wsRef.send(JSON.stringify(messagePayload));

      // Update usage after sending the message
      fetchUsage();

    } catch (error) {
      console.error('Error in handleContinueClick:', error);
      const errorMessage: Message = {
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
      };
      const updatedMessages = [...messages.slice(0, -1), errorMessage];
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  },

  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { isMobile } = useChatStateStore.getState();
    
    if (e.key === 'Enter') {
      if (isMobile) {
        return;
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          get().handleSubmit(e as any);
        }
      }
    }
  },

  handlePaste: async (e: React.ClipboardEvent) => {
    const { setSelectedImages } = useChatInputStore.getState();
    
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const { selectedImages } = useChatInputStore.getState();
          const newImages = [...selectedImages, file];
          setSelectedImages(newImages);
        }
      }
    }
  },

  canSubmit: () => {
    const { inputMessage, selectedImages, selectedFiles, isImageGenerationMode } = useChatInputStore.getState();
    const { selectedModel } = useChatStateStore.getState();

    if (!selectedModel) return false;
    if (isImageGenerationMode) {
      return inputMessage.trim().length > 0;
    }
    return inputMessage.trim().length > 0 || selectedImages.length > 0 || selectedFiles.length > 0;
  }
})); 