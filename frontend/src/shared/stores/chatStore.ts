import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { immer } from 'zustand/middleware/immer';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: Array<{ url: string; mediaType: string }>;
  isStreaming?: boolean;
  isComplete?: boolean;
  toolUsage?: Array<{
    type: 'tool_start' | 'tool_result' | 'tool_error';
    tool_name: string;
    tool_input?: string;
    output?: string;
    error?: string;
    timestamp: Date;
  }>;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
  isPinned?: boolean;
}

interface ChatState {
  // Current chat session
  currentSession: ChatSession | null;
  setCurrentSession: (session: ChatSession | null) => void;

  // Chat history
  chatHistory: ChatSession[];
  setChatHistory: (history: ChatSession[]) => void;
  addChatToHistory: (chat: ChatSession) => void;
  removeChatFromHistory: (chatId: string) => void;

  // Messages
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // WebSocket state
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  setWsStatus: (status: ChatState['wsStatus']) => void;

  // Room management state
  isConnectedToRoom: boolean;
  setIsConnectedToRoom: (connected: boolean) => void;
  isRoomCreating: boolean;
  setIsRoomCreating: (creating: boolean) => void;

  // UI states
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Loading states for specific operations
  loadingStates: {
    fetchingHistory: boolean;
    savingChat: boolean;
    deletingChat: boolean;
    loadingChat: boolean;
  };
  setLoadingState: (key: keyof ChatState['loadingStates'], value: boolean) => void;

  // Error states
  errors: {
    fetchHistory: string | null;
    saveChat: string | null;
    deleteChat: string | null;
    loadChat: string | null;
  };
  setError: (key: keyof ChatState['errors'], error: string | null) => void;
  clearErrors: () => void;

  // Chat actions
  createNewChat: () => ChatSession;
  loadChat: (chatId: string) => Promise<boolean>;
  saveChat: () => Promise<void>;
  fetchChatHistory: (force?: boolean) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  pinChat: (chatId: string, pinned: boolean) => Promise<void>;

  // Optimistic updates
  optimisticUpdate: (chatId: string, updates: Partial<ChatSession>) => void;
  revertOptimisticUpdate: (chatId: string, originalSession: ChatSession) => void;

  // Cache management
  clearCache: () => void;
  preloadChat: (chatId: string) => Promise<void>;
}

// Helper function to generate auto name from first user message
const generateChatName = (message: ChatMessage): string => {
  if (message.role === 'user' && message.content.trim()) {
    return message.content.slice(0, 20).trim();
  }
  return 'New Chat';
};

// Helper function to normalize chat data from API
const normalizeChatSession = (chat: any): ChatSession => {
  const chatName = chat.name === 'New Chat' && chat.messages?.length > 0
    ? (() => {
        const firstUserMessage = chat.messages.find((msg: any) => msg.role === 'user');
        return firstUserMessage ? firstUserMessage.content.slice(0, 20) : 'New Chat';
      })()
    : chat.name || 'New Chat';

  return {
    ...chat,
    id: chat._id ?? chat.id,
    name: chatName,
    createdAt: new Date(chat.createdAt),
    updatedAt: new Date(chat.updatedAt),
    messages: (chat.messages ?? []).map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  };
};

export const useChatStore = create<ChatState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Current session
        currentSession: null,
        setCurrentSession: (session) => set({ currentSession: session }),

        // Chat history
        chatHistory: [],
        setChatHistory: (history) => set({ chatHistory: history }),
        addChatToHistory: (chat) => set((state) => {
          state.chatHistory.unshift(chat);
        }),
        removeChatFromHistory: (chatId) => set((state) => {
          state.chatHistory = state.chatHistory.filter(chat => chat.id !== chatId);
        }),

        // Messages
        addMessage: (message) => set((state) => {
          if (!state.currentSession) return;

          // Check for duplicate messages
          const existingMessage = state.currentSession.messages.find(msg => msg.id === message.id);
          if (existingMessage) {
            console.log('Duplicate message ID detected, skipping:', message.id);
            return;
          }

          // Auto-generate chat name from first user message
          if (state.currentSession.name === 'New Chat' &&
              message.role === 'user' &&
              state.currentSession.messages.length === 0) {
            const newName = generateChatName(message);
            state.currentSession.name = newName;

            // Update in history
            const historyChat = state.chatHistory.find(chat => chat.id === state.currentSession!.id);
            if (historyChat) {
              historyChat.name = newName;
            }

            // Update backend async
            if (state.currentSession.id && state.currentSession.id.length === 24) {
              api.post('/chat/update-name', {
                chat_id: state.currentSession.id,
                name: newName
              }).catch((e) => {
                console.error('Failed to update chat name:', e);
              });
            }
          }

          // Add message
          state.currentSession.messages.push(message);
          state.currentSession.updatedAt = new Date();
        }),

        updateMessage: (messageId, updates) => set((state) => {
          if (!state.currentSession) return;

          const message = state.currentSession.messages.find(msg => msg.id === messageId);
          if (message) {
            Object.assign(message, updates);
          }
        }),

        clearMessages: () => set((state) => {
          if (state.currentSession) {
            state.currentSession.messages = [];
          }
        }),

        // WebSocket state
        wsStatus: 'disconnected',
        setWsStatus: (status) => set({ wsStatus: status }),

        // Room management state
        isConnectedToRoom: false,
        setIsConnectedToRoom: (connected) => set({ isConnectedToRoom: connected }),
        isRoomCreating: false,
        setIsRoomCreating: (creating) => set({ isRoomCreating: creating }),

        // UI states
        isTyping: false,
        setIsTyping: (typing) => set({ isTyping: typing }),

        isLoading: false,
        setIsLoading: (loading) => set({ isLoading: loading }),

        // Loading states
        loadingStates: {
          fetchingHistory: false,
          savingChat: false,
          deletingChat: false,
          loadingChat: false,
        },
        setLoadingState: (key, value) => set((state) => {
          state.loadingStates[key] = value;
        }),

        // Error states
        errors: {
          fetchHistory: null,
          saveChat: null,
          deleteChat: null,
          loadChat: null,
        },
        setError: (key, error) => set((state) => {
          state.errors[key] = error;
        }),
        clearErrors: () => set((state) => {
          Object.keys(state.errors).forEach(key => {
            state.errors[key as keyof typeof state.errors] = null;
          });
        }),

        // Actions
        createNewChat: () => {
          const newSession: ChatSession = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'New Chat',
            messages: [],
            agentId: '',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          set({ currentSession: newSession });
          return newSession;
        },

        loadChat: async (chatId: string) => {
          const { setLoadingState, setError } = get();

          setLoadingState('loadingChat', true);
          setError('loadChat', null);

          try {
            const chat = await api.get<ChatSession>(`/chat/history/${chatId}`);
            const chatSession = normalizeChatSession(chat);

            set((state) => {
              state.currentSession = chatSession;

              // Update in history if exists
              const historyChat = state.chatHistory.find(c => c.id === chatId);
              if (historyChat) {
                Object.assign(historyChat, chatSession);
              }
            });

            return true;
          } catch (error: any) {
            console.error('Failed to load chat:', error);
            setError('loadChat', error.message || 'Failed to load chat');
            return false;
          } finally {
            setLoadingState('loadingChat', false);
          }
        },

        saveChat: async () => {
          const { currentSession, setLoadingState, setError } = get();
          if (!currentSession) return;

          setLoadingState('savingChat', true);
          setError('saveChat', null);

          try {
            await api.post('/chat/save', currentSession);

            set((state) => {
              const existingIndex = state.chatHistory.findIndex(chat => chat.id === currentSession.id);

              if (existingIndex >= 0) {
                state.chatHistory[existingIndex] = currentSession;
              } else {
                state.chatHistory.unshift(currentSession);
              }
            });
          } catch (error: any) {
            console.error('Failed to save chat:', error);
            setError('saveChat', error.message || 'Failed to save chat');
          } finally {
            setLoadingState('savingChat', false);
          }
        },

        fetchChatHistory: async (force = false) => {
          const { chatHistory, setLoadingState, setError } = get();

          if (!force && chatHistory.length > 0) {
            return;
          }

          setLoadingState('fetchingHistory', true);
          setError('fetchHistory', null);

          try {
            const chats = await api.get<ChatSession[]>('/chat/history');
            const chatSessions = chats
              .filter((c: any) => c._id && c._id.length === 24)
              .map(normalizeChatSession);

            set({ chatHistory: chatSessions });
          } catch (error: any) {
            console.error('Failed to fetch chat history:', error);
            setError('fetchHistory', error.message || 'Failed to fetch chat history');
          } finally {
            setLoadingState('fetchingHistory', false);
          }
        },

        deleteChat: async (chatId: string) => {
          const { setLoadingState, setError } = get();

          setLoadingState('deletingChat', true);
          setError('deleteChat', null);

          try {
            await api.delete(`/chat/${chatId}`);

            set((state) => {
              state.chatHistory = state.chatHistory.filter(chat => chat.id !== chatId);
              if (state.currentSession?.id === chatId) {
                state.currentSession = null;
              }
            });
          } catch (error: any) {
            console.error('Failed to delete chat:', error);
            setError('deleteChat', error.message || 'Failed to delete chat');
          } finally {
            setLoadingState('deletingChat', false);
          }
        },

        pinChat: async (chatId: string, pinned: boolean) => {
          try {
            // Optimistic update
            set((state) => {
              const chat = state.chatHistory.find(c => c.id === chatId);
              if (chat) {
                chat.isPinned = pinned;
              }
              if (state.currentSession?.id === chatId) {
                state.currentSession.isPinned = pinned;
              }
            });

            await api.post(`/chat/${chatId}/pin`, { isPinned: pinned });
          } catch (error) {
            console.error('Failed to pin chat:', error);

            // Revert optimistic update
            set((state) => {
              const chat = state.chatHistory.find(c => c.id === chatId);
              if (chat) {
                chat.isPinned = !pinned;
              }
              if (state.currentSession?.id === chatId) {
                state.currentSession.isPinned = !pinned;
              }
            });
          }
        },

        // Optimistic updates
        optimisticUpdate: (chatId, updates) => set((state) => {
          const chat = state.chatHistory.find(c => c.id === chatId);
          if (chat) {
            Object.assign(chat, updates);
          }
          if (state.currentSession?.id === chatId) {
            Object.assign(state.currentSession, updates);
          }
        }),

        revertOptimisticUpdate: (chatId, originalSession) => set((state) => {
          const chatIndex = state.chatHistory.findIndex(c => c.id === chatId);
          if (chatIndex >= 0) {
            state.chatHistory[chatIndex] = originalSession;
          }
          if (state.currentSession?.id === chatId) {
            state.currentSession = originalSession;
          }
        }),

        // Cache management
        clearCache: () => set((state) => {
          state.chatHistory = [];
          state.currentSession = null;
          state.errors = {
            fetchHistory: null,
            saveChat: null,
            deleteChat: null,
            loadChat: null,
          };
        }),

        preloadChat: async (chatId: string) => {
          const { chatHistory } = get();
          const existingChat = chatHistory.find(c => c.id === chatId);

          if (!existingChat) {
            try {
              const chat = await api.get<ChatSession>(`/chat/history/${chatId}`);
              const chatSession = normalizeChatSession(chat);

              set((state) => {
                state.chatHistory.push(chatSession);
              });
            } catch (error) {
              console.error('Failed to preload chat:', error);
            }
          }
        },
      })),
      {
        name: 'chat-store',
        partialize: (state) => ({
          chatHistory: state.chatHistory.slice(0, 50), // Limit cached history
          currentSession: state.currentSession,
        }),
      }
    )
  )
);

export default useChatStore;