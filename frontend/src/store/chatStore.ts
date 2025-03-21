import { create } from 'zustand';
import { Message, ChatHistory } from '../components/chat/utils/types';
import { compressImage, prepareMessageFiles } from '../components/chat/utils/fileProcessing';
import { isValidObjectId } from '../components/chat/utils/formatters';
import { config } from '../config/config';
import { useModelStore } from './modelStore';
import { useUIStore } from './uiStore';

interface ChatState {
  // State
  messages: Message[];
  currentChatId: string | null;
  inputMessage: string;
  selectedImages: File[];
  selectedFiles: File[];
  wsRef: WebSocket | null;
  
  // Refs (to be set by components)
  messagesEndRef: React.RefObject<HTMLDivElement> | null;
  chatContainerRef: React.RefObject<HTMLDivElement> | null;
  
  // Actions - Basic state setters
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setCurrentChatId: (chatId: string | null) => void;
  setInputMessage: (message: string) => void;
  setSelectedImages: (images: File[] | ((prev: File[]) => File[])) => void;
  setSelectedFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  setMessagesEndRef: (ref: React.RefObject<HTMLDivElement>) => void;
  setChatContainerRef: (ref: React.RefObject<HTMLDivElement>) => void;
  
  // Actions - Complex operations
  initWebSocket: () => void;
  loadChatHistory: (chatId: string | null) => Promise<void>;
  createNewChat: (message: string, files?: File[], images?: File[]) => Promise<string | null>;
  sendFirstMessage: (navigatedChatId: string) => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleContinueClick: (e: React.MouseEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: (index: number) => void;
  handleRemoveFile: (index: number) => void;
  canSubmit: () => boolean;
  resetChat: () => void;
  updateMessageContent: (content: string) => void;
  completeAssistantMessage: (sources?: any[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  messages: [],
  currentChatId: null,
  inputMessage: '',
  selectedImages: [],
  selectedFiles: [],
  wsRef: null,
  messagesEndRef: null,
  chatContainerRef: null,
  
  // Basic state setters
  setMessages: (messagesOrFn) => {
    if (typeof messagesOrFn === 'function') {
      set((state) => ({ messages: messagesOrFn(state.messages) }));
    } else {
      set({ messages: messagesOrFn });
    }
  },
  
  setCurrentChatId: (chatId) => set({ currentChatId: chatId }),
  setInputMessage: (message) => set({ inputMessage: message }),
  
  setSelectedImages: (imagesOrFn) => {
    if (typeof imagesOrFn === 'function') {
      set((state) => ({ selectedImages: imagesOrFn(state.selectedImages) }));
    } else {
      set({ selectedImages: imagesOrFn });
    }
  },
  
  setSelectedFiles: (filesOrFn) => {
    if (typeof filesOrFn === 'function') {
      set((state) => ({ selectedFiles: filesOrFn(state.selectedFiles) }));
    } else {
      set({ selectedFiles: filesOrFn });
    }
  },
  
  setMessagesEndRef: (ref) => set({ messagesEndRef: ref }),
  setChatContainerRef: (ref) => set({ chatContainerRef: ref }),
  
  // WebSocket connection
  initWebSocket: () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const wsUrl = new URL(import.meta.env.VITE_WS_URL);
    wsUrl.searchParams.append('token', token);
    
    const { currentChatId } = get();
    
    // Only append chatId if it's a valid ObjectId
    if (currentChatId && isValidObjectId(currentChatId)) {
      wsUrl.searchParams.append('chat', currentChatId);
    }
    
    // Close existing connection if any
    const currentWs = get().wsRef;
    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
      currentWs.close();
    }
    
    const ws = new WebSocket(wsUrl.toString());
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error('Received error from WebSocket:', data.error);
          get().setMessages((prev) => prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant' ? {
              ...msg,
              content: `Error: ${data.error}`,
              isComplete: true
            } : msg
          ));
          return;
        }

        // Handle different message types
        switch (data.type) {
          case 'chat_created':
            // Store the chatId internally but don't update URL yet
            get().setCurrentChatId(data.chatId);
            break;

          case 'content':
            get().updateMessageContent(data.content);
            break;

          case 'complete':
            get().completeAssistantMessage(data.sources);
            
            // Now that the response is complete, update URL with chatId
            if (data.chatId) {
              get().setCurrentChatId(data.chatId);
              // Signal to components that chat has been updated with completed response
              window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId: data.chatId, complete: true } }));
            }
            break;

          case 'chat_updated':
            if (data.shouldUpdateList) {
              window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
            }
            break;

          case 'error':
            console.error('Error from server:', data.error);
            get().setMessages((prev) => prev.map((msg, index) => 
              index === prev.length - 1 && msg.role === 'assistant' ? {
                ...msg,
                content: `Error: ${data.error}`,
                isComplete: true
              } : msg
            ));
            break;
        }

        // อัพเดท usage หลังจากได้รับข้อความ
        if (data.type === 'complete') {
          await useModelStore.getState().fetchUsage();
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        get().setMessages((prev) => prev.map((msg, index) => 
          index === prev.length - 1 && msg.role === 'assistant' ? {
            ...msg,
            content: 'Error processing response. Please try again.',
            isComplete: true
          } : msg
        ));
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    set({ wsRef: ws });
  },
  
  // Helper methods for WebSocket responses
  updateMessageContent: (content) => {
    get().setMessages((prev) => prev.map((msg, index) => 
      index === prev.length - 1 && msg.role === 'assistant' ? {
        ...msg,
        content: msg.content + content
      } : msg
    ));
    
    // Auto-scroll while content is streaming if conditions are right
    const { userScrolledManually } = useUIStore.getState();
    if (!userScrolledManually) {
      const messagesEndRef = get().messagesEndRef;
      setTimeout(() => {
        messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  },
  
  completeAssistantMessage: (sources) => {
    // Re-enable auto-scrolling when message is complete, but respect user's reading position
    const { userScrolledManually, setShouldAutoScroll } = useUIStore.getState();
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
      // Explicitly scroll to bottom when message completes
      const messagesEndRef = get().messagesEndRef;
      setTimeout(() => {
        messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    
    get().setMessages((prev) => prev.map((msg, index) => 
      index === prev.length - 1 && msg.role === 'assistant' ? {
        ...msg,
        sources: sources || [],
        isComplete: true
      } : msg
    ));
  },
  
  // Load chat history
  loadChatHistory: async (chatId) => {
    if (!chatId) {
      get().resetChat();
      return;
    }
    
    if (!isValidObjectId(chatId)) {
      console.warn(`Invalid chat ID format: ${chatId}, starting new chat`);
      get().resetChat();
      return;
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/chat/chats/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const chat: ChatHistory = await response.json();
        
        set({
          messages: chat.messages || [],
          currentChatId: chatId
        });
        
        // Set selected model
        if (chat.modelId) {
          useModelStore.getState().setSelectedModel(chat.modelId);
        }
      } else {
        console.error('Failed to load chat history:', response.status, await response.text());
        get().resetChat();
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      get().resetChat();
    }
  },
  
  // Create a new chat without sending the message yet
  createNewChat: async (message, files = [], images = []) => {
    try {
      const { selectedModel } = useModelStore.getState();
      const { setIsLoading } = useUIStore.getState();
      
      if (!message.trim() || !selectedModel) {
        if (!selectedModel) {
          alert('Please select a model first');
        }
        return null;
      }
      
      setIsLoading(true);
      
      // Create a new chat via API
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Prepare the message with files/images if any
      const messageFiles = files.length > 0 
        ? await prepareMessageFiles(files)
        : undefined;
      
      let messageImages: { data: string; mediaType: string }[] = [];
      if (images.length > 0) {
        messageImages = await Promise.all(images.map(async (file) => await compressImage(file)));
      }
      
      const newMessage: Message = {
        id: 1,
        role: 'user',
        content: message,
        timestamp: { $date: new Date().toISOString() },
        files: messageFiles,
        images: messageImages.length > 0 ? messageImages : undefined
      };
      
      // Store the message in state without sending it yet
      set({ 
        messages: [newMessage],
        inputMessage: '',
        selectedImages: [],
        selectedFiles: []
      });
      
      // Create a new chat record but don't send the actual message
      const response = await fetch(`${config.apiUrl}/api/chat/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          modelId: selectedModel
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create new chat');
      }
      
      const data = await response.json();
      const chatId = data._id;
      
      // Set current chat ID and return it for navigation
      set({ currentChatId: chatId });
      return chatId;
      
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    } finally {
      useUIStore.getState().setIsLoading(false);
    }
  },
  
  // Send the first message after navigation
  sendFirstMessage: async (navigatedChatId) => {
    try {
      const { messages, wsRef } = get();
      const { selectedModel, fetchUsage } = useModelStore.getState();
      const { setIsLoading } = useUIStore.getState();
      
      if (!messages.length || !wsRef || !navigatedChatId) {
        return;
      }
      
      setIsLoading(true);
      
      // Send message to WebSocket
      const messagePayload = {
        messages,
        modelId: selectedModel,
        isImageGeneration: false,
        path: window.location.pathname,
        chatId: navigatedChatId
      };
      
      // Add placeholder for AI response
      const assistantMessage: Message = {
        id: messages.length + 1,
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
      
      set({ messages: [...messages, assistantMessage] });
      
      wsRef.send(JSON.stringify(messagePayload));
      
      // Update usage immediately after sending message
      await fetchUsage();
      
    } catch (error) {
      console.error('Error sending first message:', error);
      set({ 
        messages: [...get().messages, {
          id: get().messages.length + 1,
          role: 'assistant',
          content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred',
          timestamp: {
            $date: new Date().toISOString()
          },
          images: [],
          sources: [],
          isImageGeneration: false,
          isComplete: true
        }]
      });
    } finally {
      useUIStore.getState().setIsLoading(false);
    }
  },
  
  // Submit a new message - modified for new workflow
  handleSubmit: async (e) => {
    e.preventDefault();
    
    const { inputMessage, messages, selectedImages, selectedFiles, currentChatId, wsRef } = get();
    const { selectedModel, fetchUsage } = useModelStore.getState();
    const { isImageGenerationMode, setIsLoading, setShouldAutoScroll } = useUIStore.getState();
    
    if ((!inputMessage.trim() && !isImageGenerationMode) || !selectedModel) {
      if (!selectedModel) {
        alert('Please select a model first');
      }
      return;
    }

    // Always re-enable auto-scrolling when sending a new message
    setShouldAutoScroll(true);
    useUIStore.getState().setUserScrolledManually(false);
    
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !wsRef) {
        throw new Error('Not authenticated or WebSocket not connected');
      }
      
      // If this is the first message (no currentChatId), handle with the new workflow
      if (!currentChatId && messages.length === 0) {
        // Create a new chat and get the chat ID
        const chatId = await get().createNewChat(inputMessage, selectedFiles, selectedImages);
        
        if (!chatId) {
          throw new Error('Failed to create new chat');
        }
        
        // Signal that we need to navigate to this chat
        // Using a custom event instead of using React hooks directly
        window.dispatchEvent(new CustomEvent('newChatCreated', { 
          detail: { chatId } 
        }));
        
        return;
      }
      
      // For existing chats, continue with the normal workflow
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
      set({ messages: updatedMessages });

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
      set({ messages: [...updatedMessages, assistantMessage] });

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
      set({ 
        messages: [...get().messages.slice(0, -1), {
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
        }]
      });
    } finally {
      setIsLoading(false);
      set({
        inputMessage: '',
        selectedImages: [],
        selectedFiles: []
      });
    }
  },
  
  // Handle keyboard events
  handleKeyDown: (e) => {
    const { isMobile } = useUIStore.getState();
    
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      get().handleSubmit(e as any);
    }
  },
  
  // Handle paste events (for images)
  handlePaste: (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Validate image file size
          const maxSize = 20 * 1024 * 1024;
          if (file.size > maxSize) {
            alert('Image size must not exceed 20MB');
          } else {
            get().setSelectedImages((prev) => [...prev, file]);
          }
        }
        break;
      }
    }
  },
  
  // Continue writing feature
  handleContinueClick: (e) => {
    e.preventDefault();
    
    const { messages, currentChatId, wsRef } = get();
    const { selectedModel, fetchUsage } = useModelStore.getState();
    const { setIsLoading, setShouldAutoScroll } = useUIStore.getState();
    
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }

    // Always re-enable auto-scrolling when continuing
    setShouldAutoScroll(true);
    useUIStore.getState().setUserScrolledManually(false);
    
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
        isImageGeneration: false,
        isComplete: false
      };
      
      // Only add the assistant message to the UI
      set({ messages: [...messages, assistantMessage] });

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
      set({ 
        messages: [...get().messages.slice(0, -1), {
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
        }]
      });
    } finally {
      setIsLoading(false);
    }
  },
  
  // File selection
  handleFileSelect: (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // ถ้าเป็นไฟล์รูปภาพ
    if (e.target.id === 'image-upload') {
      get().setSelectedImages((prev) => [...prev, ...Array.from(files)]);
    } 
    // ถ้าเป็นไฟล์เอกสาร
    else if (e.target.id === 'document-upload') {
      get().setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
    }
    
    // รีเซ็ต input เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้
    e.target.value = '';
  },
  
  // File removal
  handleRemoveImage: (index) => {
    get().setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  },
  
  handleRemoveFile: (index) => {
    get().setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  },
  
  // Submission validation
  canSubmit: () => {
    const { inputMessage, selectedFiles, selectedImages } = get();
    const { selectedModel } = useModelStore.getState();
    const { isLoading, isImageGenerationMode } = useUIStore.getState();
    
    const hasText = inputMessage.trim() !== '';
    const hasFiles = selectedFiles.length > 0;
    const hasImages = selectedImages.length > 0;
    const hasModel = !!selectedModel;
    
    // In image generation mode, we allow submission even without text
    const contentValid = isImageGenerationMode ? true : (hasText || hasFiles || hasImages);
    
    return contentValid && hasModel && !isLoading;
  },
  
  // Reset chat state
  resetChat: () => {
    set({
      messages: [],
      currentChatId: null,
      inputMessage: '',
      selectedImages: [],
      selectedFiles: []
    });
    
    useUIStore.getState().setIsImageGenerationMode(false);

    // Set default model if needed
    const { models, selectedModel, setSelectedModel } = useModelStore.getState();
    if (!selectedModel && models.length > 0) {
      const defaultModel = models.find(model => model.name === 'Default');
      setSelectedModel(defaultModel?.id || models[0].id);
    }
  }
}));
