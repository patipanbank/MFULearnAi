import { create } from 'zustand';
import { Message, ChatHistory } from '../components/chat/utils/types';
import { compressImage, prepareMessageFiles } from '../components/chat/utils/fileProcessing';
import { isValidObjectId } from '../components/chat/utils/formatters';
import { config } from '../config/config';
import { useModelStore } from './modelStore';
import { useUIStore } from './uiStore';

export interface ChatState {
  // State
  messages: Message[];
  currentChatId: string | null;
  inputMessage: string;
  selectedImages: File[];
  selectedFiles: File[];
  wsRef: WebSocket | null;
  editingMessage: Message | null;
  
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
  setEditingMessage: (message: Message | null) => void;
  
  // Actions - Complex operations
  initWebSocket: () => void;
  loadChatHistory: (chatId: string | null) => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleContinueClick: (e: React.MouseEvent) => void;
  handleCancelGeneration: (e: React.MouseEvent) => void;
  handleEditMessage: (message: Message) => void;
  handleRegenerateMessage: (e: React.MouseEvent) => void;
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
  editingMessage: null,
  
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
  setEditingMessage: (message) => set({ editingMessage: message }),
  
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
            // Store the chatId internally
            get().setCurrentChatId(data.chatId);
            
            // Check if we're waiting for chat ID for early navigation
            const { awaitingChatId, setAwaitingChatId } = useUIStore.getState();
            if (awaitingChatId && data.chatId) {
              // Navigate to chat URL immediately
              setAwaitingChatId(false);
              
              // Use history.replaceState to update URL without causing a navigation event
              window.history.replaceState(null, '', `/mfuchatbot?chat=${data.chatId}`);
              
              // Trigger an event to notify that we've updated the URL
              window.dispatchEvent(new CustomEvent('chatUrlUpdated', { 
                detail: { chatId: data.chatId, early: true } 
              }));
            }
            break;

          case 'content':
            get().updateMessageContent(data.content);
            break;

          case 'complete':
            get().completeAssistantMessage(data.sources);
            
            // Now that the response is complete, update URL with chatId if not done already
            if (data.chatId) {
              get().setCurrentChatId(data.chatId);
              
              // Only navigate if we haven't done early navigation
              const { awaitingChatId } = useUIStore.getState();
              if (!awaitingChatId) {
                // Signal to components that chat has been updated with completed response
                window.dispatchEvent(new CustomEvent('chatUpdated', { 
                  detail: { chatId: data.chatId, complete: true } 
                }));
              }
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
  
  // Submit a new message
  handleSubmit: async (e) => {
    e.preventDefault();
    
    const { inputMessage, messages, selectedImages, selectedFiles, currentChatId, wsRef, editingMessage } = get();
    const { selectedModel, fetchUsage } = useModelStore.getState();
    const { isImageGenerationMode, setIsLoading, setShouldAutoScroll, setAwaitingChatId } = useUIStore.getState();
    
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

      // Reset editing state if we were editing a message
      if (editingMessage) {
        set({ editingMessage: null });
        console.log('Message edited and submitted');
      }

      // Send message to WebSocket
      const messagePayload = {
        messages: updatedMessages,
        modelId: selectedModel,
        isImageGeneration: isImageGenerationMode,
        path: window.location.pathname,
        chatId: currentChatId
      };

      // If this is a new chat, set the flag to indicate we're waiting for a chatId
      if (!currentChatId) {
        setAwaitingChatId(true);
      }

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
    
    // Process all files, categorizing them into images and documents
    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/');
      
      // Add to selected images if it's an image
      if (isImage) {
        get().setSelectedImages(prev => [...prev, file]);
      } 
      // Add to selected files if it's a document
      else {
        get().setSelectedFiles(prev => [...prev, file]);
      }
    });
    
    // Reset input to allow selecting the same file again
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
    const { isLoading } = useUIStore.getState();
    
    const hasText = inputMessage.trim() !== '';
    const hasFiles = selectedFiles.length > 0;
    const hasImages = selectedImages.length > 0;
    const hasModel = selectedModel !== '';
    
    console.log('canSubmit conditions:', { hasText, hasFiles, hasImages, hasModel, isLoading, selectedModel });
    
    return (hasText || hasFiles || hasImages) && hasModel && !isLoading;
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
  },
  
  // Cancel the current generation
  handleCancelGeneration: (e) => {
    e.preventDefault();
    
    const { wsRef, messages } = get();
    const { setIsLoading } = useUIStore.getState();
    
    if (!wsRef) {
      return;
    }
    
    try {
      // Send a cancel message to the WebSocket server
      wsRef.send(JSON.stringify({ 
        type: 'cancel',
        chatId: get().currentChatId
      }));
      
      // Update the last message to show it's been cancelled
      const updatedMessages = [...messages];
      if (updatedMessages.length > 0) {
        const lastIdx = updatedMessages.length - 1;
        if (updatedMessages[lastIdx].role === 'assistant' && !updatedMessages[lastIdx].isComplete) {
          updatedMessages[lastIdx] = {
            ...updatedMessages[lastIdx],
            content: updatedMessages[lastIdx].content + "\n\n[Generation cancelled]",
            isComplete: true
          };
          set({ messages: updatedMessages });
        }
      }
      
      // Reset loading state
      setIsLoading(false);
    } catch (error) {
      console.error('Error cancelling generation:', error);
    }
  },
  
  // Edit a message
  handleEditMessage: async (message) => {
    const { messages, currentChatId, wsRef } = get();
    
    // Find the index of the message to edit
    const messageIndex = messages.findIndex(m => m.id === message.id);
    if (messageIndex === -1) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // If it's a user message, we need to handle it as before
      if (message.role === 'user') {
        // Set the message to edit
        set({ editingMessage: message });
        
        // Put the user message in the input area
        set({ inputMessage: message.content });
        
        // Remove this message and all messages after it
        const newMessages = messages.slice(0, messageIndex);
        set({ messages: newMessages });
      } 
      // If it's an assistant message, we update the content directly
      else if (message.role === 'assistant') {
        // Update the message in the local state
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
          ...message,
          isEdited: true, // Add a flag to indicate this message was edited
        };
        
        set({ messages: updatedMessages });
        
        // Send update to backend
        if (currentChatId) {
          try {
            console.log('Sending edit message request:', {
              chatId: currentChatId,
              messageId: message.id,
              messageIdType: typeof message.id,
              messageIdStringified: JSON.stringify(message.id),
              messageIdValue: String(message.id),
              content: message.content ? message.content.substring(0, 50) + '...' : null
            });
            
            // Make sure messageId is a string 
            const messageId = String(message.id);
            
            if (!messageId) {
              throw new Error('Invalid message ID');
            }
            
            const requestBody = {
              chatId: currentChatId,
              messageId: messageId,
              content: message.content
            };
            
            console.log('Final request body:', JSON.stringify(requestBody));
            
            const response = await fetch(`${config.apiUrl}/api/chat/edit-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('Edit message failed:', response.status, errorData);
              throw new Error(errorData.error || 'Failed to update message');
            }
            
            // Notify websocket to broadcast update to other connected clients
            if (wsRef && wsRef.readyState === WebSocket.OPEN) {
              wsRef.send(JSON.stringify({
                type: 'message_edited',
                chatId: currentChatId,
                messageId: message.id,
                content: message.content
              }));
            }
            
            console.log('Message updated successfully');
          } catch (error) {
            console.error('Error updating message:', error);
            throw error;
          }
        } else {
          console.error('Cannot update message: No chat ID');
        }
      }
    } catch (error) {
      console.error('Error in handleEditMessage:', error);
      alert('Failed to edit message. Please try again.');
    }
  },
  
  // Regenerate the last assistant message
  handleRegenerateMessage: (e) => {
    e.preventDefault();
    
    const { messages, wsRef, currentChatId } = get();
    const { selectedModel, fetchUsage } = useModelStore.getState();
    const { setIsLoading, setShouldAutoScroll } = useUIStore.getState();
    
    if (!selectedModel || !wsRef) {
      alert('Please select a model first');
      return;
    }
    
    // Find the last user message
    const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.role === 'user');
    if (lastUserMessageIndex === -1) return;
    
    // Get all messages up to and including the last user message
    const lastUserRealIndex = messages.length - 1 - lastUserMessageIndex;
    const messagesToKeep = messages.slice(0, lastUserRealIndex + 1);
    
    // Add placeholder for new AI response
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
    
    // Reset scroll position
    setShouldAutoScroll(true);
    useUIStore.getState().setUserScrolledManually(false);
    
    // Update messages and set loading state
    set({ messages: [...messagesToKeep, assistantMessage] });
    setIsLoading(true);
    
    try {
      // Send regenerate request to websocket
      const messagePayload = {
        messages: messagesToKeep,
        modelId: selectedModel,
        isImageGeneration: false,
        path: window.location.pathname,
        chatId: currentChatId,
        type: 'regenerate'
      };
      
      wsRef.send(JSON.stringify(messagePayload));
      
      // Update usage
      fetchUsage();
    } catch (error) {
      console.error('Error in handleRegenerateMessage:', error);
      set({ 
        messages: [...messagesToKeep, {
          id: messages.length + 1,
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
      setIsLoading(false);
    }
  }
}));
