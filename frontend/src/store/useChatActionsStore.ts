import { create } from 'zustand';
import { Message } from '../components/chat/utils/types';
import useChatStore from './useChatStore';
import useChatWebSocketStore from './useChatWebSocketStore';
import { compressImage, prepareMessageFiles, validateImageFile } from '../components/chat/utils/fileProcessing';

interface ChatActionsState {
  // Chat actions
  handleSubmit: (e: React.FormEvent, location: { pathname: string }) => Promise<void>;
  handleContinueClick: (e: React.MouseEvent, location: { pathname: string }) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, location: { pathname: string }) => void;
  handlePaste: (e: React.ClipboardEvent) => Promise<void>;
  
  // UI helpers
  canSubmit: () => boolean;
}

const useChatActionsStore = create<ChatActionsState>((_set, get) => ({
  handleSubmit: async (e: React.FormEvent, location: { pathname: string }) => {
    e.preventDefault();
    
    const chatStore = useChatStore.getState();
    const wsStore = useChatWebSocketStore.getState();
    
    const { 
      inputMessage, 
      selectedModel, 
      isImageGenerationMode,
      messages,
      selectedImages,
      selectedFiles,
      currentChatId
    } = chatStore;
    
    if (!inputMessage.trim() && !isImageGenerationMode) return;
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }
    
    chatStore.setIsLoading(true);
    
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
      chatStore.setMessages(updatedMessages);
      
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
      chatStore.setMessages([...updatedMessages, assistantMessage]);
      
      // Send message to WebSocket
      wsStore.sendMessage(
        updatedMessages,
        selectedModel,
        isImageGenerationMode,
        location.pathname,
        currentChatId
      );
      
      // Update usage immediately after sending message
      await chatStore.fetchUsage();
      
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
      chatStore.setMessages([...messages.slice(0, -1), errorMessage]);
    } finally {
      chatStore.setIsLoading(false);
      chatStore.setInputMessage('');
      chatStore.setSelectedImages([]);
      chatStore.setSelectedFiles([]);
    }
  },
  
  handleContinueClick: async (e: React.MouseEvent, location: { pathname: string }) => {
    e.preventDefault();
    
    const chatStore = useChatStore.getState();
    const wsStore = useChatWebSocketStore.getState();
    
    const { 
      selectedModel, 
      messages,
      currentChatId 
    } = chatStore;
    
    if (!selectedModel) {
      alert('Please select a model first');
      return;
    }
    
    chatStore.setIsLoading(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
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
      chatStore.setMessages([...messages, assistantMessage]);
      
      // Send message to WebSocket with both messages
      wsStore.sendMessage(
        [...messages, continueMessage],
        selectedModel,
        false,
        location.pathname,
        currentChatId
      );
      
      // Update usage after sending the message
      chatStore.fetchUsage();
      
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
      chatStore.setMessages([...messages.slice(0, -1), errorMessage]);
    } finally {
      chatStore.setIsLoading(false);
    }
  },
  
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, location: { pathname: string }) => {
    const chatStore = useChatStore.getState();
    const { isMobile } = chatStore;
    
    if (e.key === 'Enter') {
      if (isMobile) {
        return;
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          get().handleSubmit(e as unknown as React.FormEvent, location);
        }
      }
    }
  },
  
  handlePaste: async (e: React.ClipboardEvent) => {
    const chatStore = useChatStore.getState();
    
    // Check if clipboard contains images
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          // Validate image file (size, type)
          const isValid = await validateImageFile(file);
          if (isValid) {
            const newSelectedImages = [...chatStore.selectedImages, file];
            chatStore.setSelectedImages(newSelectedImages);
          }
        }
      }
    }
  },
  
  canSubmit: () => {
    const chatStore = useChatStore.getState();
    const { 
      inputMessage, 
      isLoading, 
      selectedImages, 
      isImageGenerationMode,
      selectedFiles
    } = chatStore;
    
    // Can submit if there's text or images/files to send and not currently loading
    return !isLoading && (
      inputMessage.trim().length > 0 || 
      selectedImages.length > 0 || 
      selectedFiles.length > 0 ||
      isImageGenerationMode
    );
  }
}));

export default useChatActionsStore; 