import { create } from 'zustand';
import { Message, ChatHistory, MessageFile } from '../utils/types';
import { compressImage, prepareMessageFiles } from '../utils/fileProcessing';
import { isValidObjectId } from '../utils/formatters';
import { config } from '../../../config/config';
import { useModelStore } from './modelStore';
import { useUIStore } from './uiStore';

export interface ChatState {
  // State
  messages: Message[];
  currentChatId: string | null;
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
    const { userScrolledManually, scrollToBottom } = useUIStore.getState();
    if (!userScrolledManually) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  },
  
  completeAssistantMessage: (sources) => {
    // Re-enable auto-scrolling when message is complete, but respect user's reading position
    const { userScrolledManually, setShouldAutoScroll, setIsLoading, scrollToBottom, updateScrollPosition } = useUIStore.getState();
    
    // ตั้งค่า isLoading เป็น false เมื่อข้อความเสร็จสมบูรณ์
    setIsLoading(false);
    
    // อัปเดตสถานะ scroll ทันทีเมื่อข้อความเสร็จสมบูรณ์
    updateScrollPosition();
    
    if (!userScrolledManually) {
      setShouldAutoScroll(true);
      // Explicitly scroll to bottom when message completes
      setTimeout(() => {
        scrollToBottom();
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
    
    const { selectedModel } = useModelStore.getState();
    const { messages, selectedImages, selectedFiles, currentChatId, wsRef, editingMessage } = get();
    
    const { isImageGenerationMode, setIsLoading, setShouldAutoScroll, setAwaitingChatId, inputMessage } = useUIStore.getState();
    
    if ((!inputMessage.trim() && !isImageGenerationMode) || !selectedModel) {
      console.log('Cannot submit: empty message or no model selected');
      return;
    }
    
    try {
      setIsLoading(true);
      setShouldAutoScroll(true);
      
      // แปลงรูปภาพและไฟล์
      let images: { data: string; mediaType: string }[] = [];
      let files: MessageFile[] = [];
      
      // จัดการรูปภาพ
      if (selectedImages.length > 0) {
        images = await Promise.all(selectedImages.map(async (file) => await compressImage(file)));
      }
      
      // จัดการไฟล์
      if (selectedFiles.length > 0) {
        files = await prepareMessageFiles(selectedFiles);
      }
      
      // Handle message edit mode
      if (editingMessage) {
        // หาตำแหน่งของข้อความที่ต้องการแก้ไข
        const messageIndex = messages.findIndex(m => m.id === editingMessage.id);
        if (messageIndex === -1) return;
        
        // ถ้าเป็นข้อความของผู้ใช้
        if (editingMessage.role === 'user') {
          // สร้างข้อความผู้ใช้ที่แก้ไขแล้ว
          const updatedUserMessage: Message = {
            ...editingMessage,
            content: inputMessage,
            images: images.length > 0 ? images : editingMessage.images,
            files: files.length > 0 ? files : editingMessage.files,
            isEdited: true
          };
          
          // ลบข้อความนี้และข้อความหลังจากนี้ทั้งหมด
          const newMessages = messages.slice(0, messageIndex);
          
          // เพิ่มข้อความที่แก้ไขแล้ว
          newMessages.push(updatedUserMessage);
          
          // สร้างข้อความตอบกลับใหม่จาก AI
          const newAssistantMessage: Message = {
            id: `temp-assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: { $date: new Date().toISOString() },
            isImageGeneration: isImageGenerationMode,
            modelId: selectedModel,
            isComplete: false
          };
          
          // เพิ่มข้อความตอบกลับใหม่
          newMessages.push(newAssistantMessage);
          
          // อัปเดตข้อความทั้งหมด
          set({ messages: newMessages });
          
          // ส่งข้อความที่แก้ไขผ่าน WebSocket
          if (wsRef) {
            setAwaitingChatId(true);
            wsRef.send(JSON.stringify({
              type: 'edit',
              content: inputMessage,
              chatId: currentChatId,
              modelId: selectedModel,
              messageId: editingMessage.id,
              images: images,
              files: files,
              isImageGeneration: isImageGenerationMode,
              messages: newMessages,
              path: window.location.pathname
            }));
          }
          
          // ล้างค่าต่างๆ
          useUIStore.getState().setInputMessage('');
          set({ 
            selectedImages: [],
            selectedFiles: [],
            editingMessage: null
          });
        }
        // ถ้าเป็นข้อความของ AI (ในกรณีนี้เราไม่ต้องส่งข้อความใหม่ แค่แก้ไขข้อความในฐานข้อมูล)
        else if (editingMessage.role === 'assistant') {
          // ไม่รองรับการแก้ไขข้อความของ AI โดยตรงในตัวอย่างนี้
          // หากต้องการรองรับจริงๆ ควรมีการทำ API call ไปยัง server เพื่อแก้ไขข้อความ
          console.log('Editing assistant messages is not supported');
          set({ editingMessage: null });
        }
      } else {
        // Create a new user message
        const newUserMessage: Message = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: inputMessage,
          timestamp: { $date: new Date().toISOString() },
          images: images.length > 0 ? images : undefined,
          files: files.length > 0 ? files : undefined
        };
        
        // Create a loading assistant message
        const newAssistantMessage: Message = {
          id: `temp-assistant-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: { $date: new Date().toISOString() },
          isImageGeneration: isImageGenerationMode,
          modelId: selectedModel,
          isComplete: false
        };
        
        // สร้างอาร์เรย์ข้อความที่อัปเดตแล้ว (รวมข้อความของผู้ใช้ที่เพิ่มเข้ามาใหม่)
        const updatedMessages = [...messages, newUserMessage];
        
        // Add both messages to the state
        set((state) => ({
          messages: [...state.messages, newUserMessage, newAssistantMessage]
        }));
        
        // Send message via WebSocket
        if (wsRef) {
          setAwaitingChatId(true);
          console.log('Sending message via WebSocket');
          wsRef.send(JSON.stringify({
            type: 'chat',
            content: inputMessage,
            chatId: currentChatId,
            modelId: selectedModel,
            images: images,
            files: files,
            isImageGeneration: isImageGenerationMode,
            messages: updatedMessages, // ส่ง messages ทั้งหมดรวมข้อความใหม่
            path: window.location.pathname // เพิ่ม path เพื่อให้เหมือนโค้ดเดิม
          }));
        } else {
          console.error('WebSocket not connected');
          set((state) => ({
            messages: state.messages.map((msg) => 
              msg.id === newAssistantMessage.id 
                ? { ...msg, content: 'Error: WebSocket not connected. Please refresh and try again.', loading: false, error: true } 
                : msg
            )
          }));
          
          // Set isLoading to false in case of error
          useUIStore.getState().setIsLoading(false);
        }
        
        // Clear the input and selected files
        useUIStore.getState().setInputMessage('');
        set({ 
          selectedImages: [],
          selectedFiles: [],
          editingMessage: null
        });
        
        // ไม่ reset isLoading ที่นี่ เพราะต้องรอให้ streaming เสร็จก่อน
      }
    } catch (error) {
      console.error('Error submitting message:', error);
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
  handlePaste: async (e) => {
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
    
    const { setIsLoading, setShouldAutoScroll } = useUIStore.getState();
    const { selectedModel } = useModelStore.getState();
    const { messages, wsRef, currentChatId } = get();
    
    if (!wsRef || messages.length === 0 || !selectedModel) {
      console.error('Cannot continue: WebSocket not connected, no messages, or no model selected');
      return;
    }
    
    try {
      setIsLoading(true);
      setShouldAutoScroll(true);
      
      const lastMessage = messages[messages.length - 1];
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      
      // สร้างข้อความสำหรับการสั่งให้ AI ทำงานต่อ (ไม่แสดงใน UI)
      const continueMessage: Message = {
        id: `temp-continue-${Date.now()}`,
        role: 'user',
        content: "Continue writing",
        timestamp: { $date: new Date().toISOString() }
      };
      
      // Create new assistant message
      const newAssistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: { $date: new Date().toISOString() },
        modelId: selectedModel,
        isComplete: false
      };
      
      // ข้อความทั้งหมดรวมกับข้อความ "Continue writing"
      const updatedMessages = [...messages, continueMessage];
      
      // Add the assistant message to UI (but not the continue message)
      set((state) => ({
        messages: [...state.messages, newAssistantMessage]
      }));
      
      // Send continue command via WebSocket
      wsRef.send(JSON.stringify({
        type: 'continue',
        chatId: currentChatId,
        modelId: selectedModel,
        lastMessageId: lastMessage.id,
        context: lastUserMessage?.content || '',
        messages: updatedMessages, // ส่งข้อความทั้งหมดรวมข้อความ "Continue writing"
        isImageGeneration: false,
        path: window.location.pathname
      }));
    } catch (error) {
      console.error('Error sending continue command:', error);
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
    const { selectedFiles, selectedImages } = get();
    
    const { isLoading, inputMessage } = useUIStore.getState();
    const { selectedModel } = useModelStore.getState();
    
    const hasText = inputMessage.trim() !== '';
    const hasFiles = selectedFiles.length > 0;
    const hasImages = selectedImages.length > 0;
    const hasModel = !!selectedModel;
    
    console.log('canSubmit conditions:', { hasText, hasFiles, hasImages, hasModel, isLoading, selectedModel });
    
    return (hasText || hasFiles || hasImages) && hasModel && !isLoading;
  },
  
  // Reset chat state
  resetChat: () => {
    set({ 
      messages: [], 
      currentChatId: null, 
      selectedImages: [],
      selectedFiles: [], 
      editingMessage: null 
    });
    useUIStore.getState().setIsImageGenerationMode(false);
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
      // มั่นใจว่า isLoading ถูกตั้งค่าเป็น false แม้ในกรณีเกิดข้อผิดพลาด
      setIsLoading(false);
    }
  },
  
  // Edit a message
  handleEditMessage: (message) => {
    // ใช้ setInputMessage จาก uiStore แทน
    useUIStore.getState().setInputMessage(message.content);
    set({ editingMessage: message });
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
        messages: messagesToKeep, // ส่งเฉพาะข้อความถึงข้อความผู้ใช้ล่าสุด
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
          isImageGeneration: false,
          isComplete: true
        }]
      });
      setIsLoading(false);
    }
  }
}));
