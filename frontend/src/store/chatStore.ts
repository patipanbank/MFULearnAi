import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
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
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleContinueClick: (e: React.MouseEvent) => void;
  cancelGeneration: (e: React.MouseEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: (index: number) => void;
  handleRemoveFile: (index: number) => void;
  canSubmit: () => boolean;
  resetChat: () => void;
  updateMessageContent: (content: string) => void;
  completeAssistantMessage: (sources?: any[]) => void;
  createEmptyChat: (modelId: string) => Promise<string | null>;
}

// Selectors for better performance
export const chatSelectors = {
  getMessages: (state: ChatState) => state.messages,
  getCurrentChatId: (state: ChatState) => state.currentChatId,
  getInputMessage: (state: ChatState) => state.inputMessage,
  getSelectedImages: (state: ChatState) => state.selectedImages,
  getSelectedFiles: (state: ChatState) => state.selectedFiles,
  getCanSubmit: (state: ChatState) => state.canSubmit(),
};

// Messages slice - manage messages and related operations
const createMessagesSlice = (set: any, get: any) => ({
  messages: [],
  
  setMessages: (messagesOrFn: Message[] | ((prev: Message[]) => Message[])) => {
    if (typeof messagesOrFn === 'function') {
      set((state: ChatState) => ({ messages: messagesOrFn(state.messages) }), false, 'setMessages/function');
    } else {
      set({ messages: messagesOrFn }, false, 'setMessages/direct');
    }
  },
  
  updateMessageContent: (content: string) => {
    get().setMessages((prev: Message[]) => prev.map((msg, index) => 
      index === prev.length - 1 && msg.role === 'assistant' ? {
        ...msg,
        content: msg.content + content
      } : msg
    ));
  },
  
  completeAssistantMessage: (sources?: any[]) => {
    get().setMessages((prev: Message[]) => prev.map((msg, index) => 
      index === prev.length - 1 && msg.role === 'assistant' ? {
        ...msg,
        sources: sources || [],
        isComplete: true
      } : msg
    ));
  },
});

// Files slice - manage file uploads and related operations
const createFilesSlice = (set: any, get: any) => ({
  selectedImages: [] as File[],
  selectedFiles: [] as File[],
  
  setSelectedImages: (imagesOrFn: File[] | ((prev: File[]) => File[])) => {
    if (typeof imagesOrFn === 'function') {
      set((state: ChatState) => ({ selectedImages: imagesOrFn(state.selectedImages) }), false, 'setSelectedImages/function');
    } else {
      set({ selectedImages: imagesOrFn }, false, 'setSelectedImages/direct');
    }
  },
  
  setSelectedFiles: (filesOrFn: File[] | ((prev: File[]) => File[])) => {
    if (typeof filesOrFn === 'function') {
      set((state: ChatState) => ({ selectedFiles: filesOrFn(state.selectedFiles) }), false, 'setSelectedFiles/function');
    } else {
      set({ selectedFiles: filesOrFn }, false, 'setSelectedFiles/direct');
    }
  },
  
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (e.target.id === 'image-upload') {
      get().setSelectedImages((prev: File[]) => [...prev, ...Array.from(files)]);
    } 
    else if (e.target.id === 'document-upload') {
      get().setSelectedFiles((prev: File[]) => [...prev, ...Array.from(files)]);
    }
    
    e.target.value = '';
  },
  
  handleRemoveImage: (index: number) => {
    get().setSelectedImages((prev: File[]) => prev.filter((_, i) => i !== index));
  },
  
  handleRemoveFile: (index: number) => {
    get().setSelectedFiles((prev: File[]) => prev.filter((_, i) => i !== index));
  },
});

export const useChatStore = create<ChatState>()(
  subscribeWithSelector(
    devtools(
      (set, get) => ({
        // Initial state
        currentChatId: null,
        inputMessage: '',
        wsRef: null,
        messagesEndRef: null,
        chatContainerRef: null,
        
        // Include slices
        ...createMessagesSlice(set, get),
        ...createFilesSlice(set, get),
        
        // Basic state setters
        setCurrentChatId: (chatId) => set({ currentChatId: chatId }, false, 'setCurrentChatId'),
        setInputMessage: (message) => set({ inputMessage: message }, false, 'setInputMessage'),
        setMessagesEndRef: (ref) => set({ messagesEndRef: ref }, false, 'setMessagesEndRef'),
        setChatContainerRef: (ref) => set({ chatContainerRef: ref }, false, 'setChatContainerRef'),
        
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
                  // Store the chatId internally but don't update URL if we already have one
                  if (!get().currentChatId) {
                    set({ currentChatId: data.chatId }, false, 'wsMessage/chat_created');
                    
                    // Only update URL if not already set by the new workflow
                    if (!window.location.search.includes(`chat=${data.chatId}`)) {
                      window.history.replaceState({}, '', `/mfuchatbot?chat=${data.chatId}`);
                    }
                  }
                  break;

                case 'content':
                  get().updateMessageContent(data.content);
                  // Dispatch event for scroll behavior
                  window.dispatchEvent(new CustomEvent('messageContentUpdated'));
                  break;

                case 'complete':
                  get().completeAssistantMessage(data.sources);
                  
                  // If somehow we don't have the chatId yet, update it
                  if (data.chatId && !get().currentChatId) {
                    set({ currentChatId: data.chatId }, false, 'wsMessage/complete');
                    
                    // Only update URL if not already set
                    if (!window.location.search.includes(`chat=${data.chatId}`)) {
                      window.history.replaceState({}, '', `/mfuchatbot?chat=${data.chatId}`);
                    }
                    
                    // Signal to components that chat has been updated with completed response
                    window.dispatchEvent(new CustomEvent('chatUpdated', { 
                      detail: { chatId: data.chatId, complete: true }
                    }));
                  }
                  
                  // Signal message completion for usage updates
                  window.dispatchEvent(new CustomEvent('messageCompleted'));
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

          set({ wsRef: ws }, false, 'initWebSocket');
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
              }, false, 'loadChatHistory/success');
              
              // Signal to components to update model selection
              if (chat.modelId) {
                window.dispatchEvent(new CustomEvent('modelSelectionNeeded', {
                  detail: { modelId: chat.modelId }
                }));
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
        
        // Create an empty chat to get a chatId before sending the first message
        createEmptyChat: async (modelId: string) => {
          try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
              throw new Error('Not authenticated');
            }

            const response = await fetch(`${config.apiUrl}/api/chat/create-empty-chat`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ modelId })
            });

            if (response.ok) {
              const data = await response.json();
              set({ currentChatId: data.chatId }, false, 'createEmptyChat/success');
              return data.chatId;
            } else {
              console.error('Failed to create empty chat:', response.status);
              return null;
            }
          } catch (error) {
            console.error('Error creating empty chat:', error);
            return null;
          }
        },
        
        // Submit a new message
        handleSubmit: async (e) => {
          e.preventDefault();
          
          const { inputMessage, messages, selectedImages, selectedFiles, currentChatId, wsRef, createEmptyChat } = get();
          const selectedModel = useModelStore.getState().selectedModel;
          const isImageGenerationMode = useUIStore.getState().isImageGenerationMode;
          
          if ((!inputMessage.trim() && !isImageGenerationMode) || !selectedModel) {
            if (!selectedModel) {
              alert('Please select a model first');
            }
            return;
          }

          // Signal loading state and scroll state changes
          window.dispatchEvent(new CustomEvent('messageSending', { 
            detail: { scrollToBottom: true }
          }));
          
          try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
              throw new Error('Not authenticated');
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
            set({ messages: updatedMessages }, false, 'handleSubmit/addUserMessage');

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
            set({ messages: [...updatedMessages, assistantMessage] }, false, 'handleSubmit/addAssistantPlaceholder');

            // If this is a new chat, create an empty chat first to get a chatId
            let chatId = currentChatId;
            
            if (!chatId) {
              // Create empty chat and get chatId
              chatId = await createEmptyChat(selectedModel);
              
              if (chatId) {
                // Update navigation with new chatId
                window.history.replaceState({}, '', `/mfuchatbot?chat=${chatId}`);
                window.dispatchEvent(new CustomEvent('chatCreated', { detail: { chatId } }));
              }
            }
            
            // Make sure the WebSocket is connected
            if (!wsRef) {
              get().initWebSocket();
              
              // Small delay to ensure WebSocket is connected
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Send message to WebSocket
            const messagePayload = {
              messages: updatedMessages,
              modelId: selectedModel,
              isImageGeneration: isImageGenerationMode,
              path: window.location.pathname,
              chatId
            };

            const currentWsRef = get().wsRef;
            // Make sure wsRef exists before sending
            if (currentWsRef) {
              currentWsRef.send(JSON.stringify(messagePayload));
            } else {
              throw new Error('WebSocket not connected');
            }

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
            }, false, 'handleSubmit/error');
          } finally {
            // Signal that we're done sending and clean up
            window.dispatchEvent(new CustomEvent('messageSent'));
            
            set({
              inputMessage: '',
              selectedImages: [],
              selectedFiles: []
            }, false, 'handleSubmit/cleanup');
          }
        },
        
        // Handle keyboard events
        handleKeyDown: (e) => {
          const isMobile = useUIStore.getState().isMobile;
          
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
          const selectedModel = useModelStore.getState().selectedModel;
          
          if (!selectedModel) {
            alert('Please select a model first');
            return;
          }

          // Signal loading and scroll state changes
          window.dispatchEvent(new CustomEvent('messageSending', { 
            detail: { scrollToBottom: true }
          }));

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
            set({ messages: [...messages, assistantMessage] }, false, 'handleContinueClick/addAssistantPlaceholder');

            // Send message to WebSocket with both messages
            const messagePayload = {
              messages: [...messages, continueMessage],
              modelId: selectedModel,
              isImageGeneration: false,
              path: window.location.pathname,
              chatId: currentChatId
            };

            wsRef.send(JSON.stringify(messagePayload));

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
            }, false, 'handleContinueClick/error');
          } finally {
            // Signal that we're done with the continue operation
            window.dispatchEvent(new CustomEvent('messageSent'));
          }
        },
        
        // Submission validation
        canSubmit: () => {
          const { inputMessage, selectedFiles, selectedImages } = get();
          const selectedModel = useModelStore.getState().selectedModel;
          const isLoading = useUIStore.getState().isLoading;
          
          const hasText = inputMessage.trim() !== '';
          const hasFiles = selectedFiles.length > 0;
          const hasImages = selectedImages.length > 0;
          const hasModel = selectedModel !== '';
          
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
          }, false, 'resetChat');
          
          // Signal UI state reset
          window.dispatchEvent(new CustomEvent('chatReset'));
        },
        
        // Cancel generation
        cancelGeneration: (e) => {
          e.preventDefault();
          
          const { wsRef, messages } = get();
          
          // Close the WebSocket connection to stop the generation
          if (wsRef && wsRef.readyState === WebSocket.OPEN) {
            wsRef.close();
          }
          
          // Mark the current assistant message as complete with a cancelled note
          get().setMessages((prev) => prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant' ? {
              ...msg,
              content: msg.content + " [Generation cancelled]",
              isComplete: true
            } : msg
          ));
          
          // Signal that we're no longer loading
          window.dispatchEvent(new CustomEvent('messageSent'));
          
          // Reestablish the WebSocket connection
          get().initWebSocket();
        }
      }),
      { name: 'chat-store' }
    )
  )
);

// Set up store communication via events
// Listen for events to update UI state
window.addEventListener('messageSending', (e: Event) => {
  const detail = (e as CustomEvent).detail || {};
  const uiStore = useUIStore.getState();
  
  uiStore.setIsLoading(true);
  
  if (detail.scrollToBottom) {
    uiStore.setUserScrolledManually(false);
    uiStore.setShouldAutoScroll(true);
  }
});

window.addEventListener('messageSent', () => {
  useUIStore.getState().setIsLoading(false);
});

window.addEventListener('messageContentUpdated', () => {
  const chatStore = useChatStore.getState();
  const userScrolledManually = useUIStore.getState().userScrolledManually;
  
  if (!userScrolledManually && chatStore.messagesEndRef) {
    setTimeout(() => {
      if (chatStore.messagesEndRef && chatStore.messagesEndRef.current) {
        chatStore.messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }
});

window.addEventListener('messageCompleted', () => {
  useModelStore.getState().fetchUsage();
});

window.addEventListener('chatReset', () => {
  useUIStore.getState().setIsImageGenerationMode(false);
  
  // Set default model if needed
  const modelStore = useModelStore.getState();
  if (!modelStore.selectedModel && modelStore.models.length > 0) {
    const defaultModel = modelStore.models.find(model => model.name === 'Default');
    modelStore.setSelectedModel(defaultModel?.id || modelStore.models[0].id);
  }
});

window.addEventListener('modelSelectionNeeded', (e: Event) => {
  const detail = (e as CustomEvent).detail;
  if (detail?.modelId) {
    useModelStore.getState().setSelectedModel(detail.modelId);
  }
});

window.addEventListener('chatCreated', (e: Event) => {
  const detail = (e as CustomEvent).detail;
  if (detail?.chatId) {
    // Update chat store with the new chatId if not already set
    const chatStore = useChatStore.getState();
    if (!chatStore.currentChatId) {
      chatStore.setCurrentChatId(detail.chatId);
    }
  }
});
