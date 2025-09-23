import { create } from 'zustand';
import { api } from '../lib/api';

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

interface ChatHistoryFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  pinned?: boolean;
}

interface ChatHistoryPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ChatAnalytics {
  summary: {
    totalConversations: number;
    activeConversations: number;
    pinnedConversations: number;
    totalMessages: number;
    totalTokens: number;
    averageResponseTime: number;
    averageMessagesPerConversation: number;
  };
  trends: any[];
  agents: any[];
  models: any[];
  period: {
    from?: string;
    to?: string;
  };
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

  // Enhanced history management
  historyFilters: ChatHistoryFilters;
  setHistoryFilters: (filters: ChatHistoryFilters) => void;
  historyPagination: ChatHistoryPagination;
  setHistoryPagination: (pagination: ChatHistoryPagination) => void;

  // Analytics
  analytics: ChatAnalytics | null;
  setAnalytics: (analytics: ChatAnalytics | null) => void;
  
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

  // Workflow state
  workflowState: {
    isActive: boolean;
    currentNode?: string;
    workflowEngine?: string;
    features?: {
      stateManagement?: boolean;
      conditionalRouting?: boolean;
      toolIntegration?: boolean;
      memoryPersistence?: boolean;
    };
  } | null;
  setWorkflowState: (state: ChatState['workflowState']) => void;
  
  // Chat actions
  createNewChat: () => ChatSession;
  loadChat: (chatId: string) => Promise<boolean>;
  saveChat: () => Promise<void>;
  fetchChatHistory: (force?: boolean) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  pinChat: (chatId: string, pinned: boolean) => void;

  // Enhanced history actions
  fetchChatHistoryFiltered: (filters?: ChatHistoryFilters, page?: number, limit?: number) => Promise<void>;
  searchConversations: (query: string) => Promise<any[]>;
  exportConversations: (conversationIds: string[], format?: 'json' | 'csv' | 'markdown') => Promise<void>;
  bulkOperations: (action: 'delete' | 'archive' | 'pin' | 'unpin', conversationIds: string[]) => Promise<void>;
  fetchAnalytics: (dateFrom?: string, dateTo?: string, agentId?: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Current session
  currentSession: null,
  setCurrentSession: (session) => set({ currentSession: session }),

  // Chat history
  chatHistory: [],
  setChatHistory: (history) => set({ chatHistory: history }),
  addChatToHistory: (chat) => set((state) => ({
    chatHistory: [chat, ...state.chatHistory]
  })),
  removeChatFromHistory: (chatId) => set((state) => ({
    chatHistory: state.chatHistory.filter(chat => chat.id !== chatId)
  })),

  // Enhanced history management
  historyFilters: {},
  setHistoryFilters: (filters) => set({ historyFilters: filters }),
  historyPagination: { page: 1, limit: 50, total: 0, pages: 0 },
  setHistoryPagination: (pagination) => set({ historyPagination: pagination }),

  // Analytics
  analytics: null,
  setAnalytics: (analytics) => set({ analytics }),
  
  // Messages
  addMessage: (message) => {
    const state = get();
    if (!state.currentSession) return;

    // Check for duplicate messages by ID - simplified check since backend handles deduplication
    const existingMessage = state.currentSession.messages.find(msg => msg.id === message.id);
    if (existingMessage) {
      console.log('Duplicate message ID detected, skipping:', message.id);
      return;
    }
    let updatedName = state.currentSession.name;
    let shouldUpdateName = false;
    // เปลี่ยนชื่อแชทเฉพาะตอนแรกเท่านั้น
    if (
      (state.currentSession.name === 'New Chat' || !state.currentSession.name) &&
      message.role === 'user' &&
      state.currentSession.messages.length === 0
    ) {
      updatedName = message.content.slice(0, 20);
      shouldUpdateName = true;
    }
    const updatedSession = {
      ...state.currentSession,
      name: updatedName,
      messages: [...state.currentSession.messages, message],
      updatedAt: new Date()
    };
    set({ currentSession: updatedSession });
    // อัปเดตชื่อไป backend แค่ครั้งเดียว
    if (shouldUpdateName) {
      // Update chatHistory immediately
      set((prev) => ({
        chatHistory: prev.chatHistory.map(chat =>
          chat.id === state.currentSession!.id
            ? { ...chat, name: updatedName }
            : chat
        )
      }));
      
      // Make API call in background
      if (state.currentSession.id && state.currentSession.id.length === 24) {
        api.post('/chat/update-name', {
          chat_id: state.currentSession.id,
          name: updatedName
        }).catch((e) => {
          console.error('Failed to update chat name:', e);
        });
      }
    }
  },
  
  updateMessage: (messageId, updates) => set((state) => {
    if (!state.currentSession) return state;
    
    const updatedMessages = state.currentSession.messages.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    
    return {
      currentSession: {
        ...state.currentSession,
        messages: updatedMessages
      }
    };
  }),
  
  clearMessages: () => set((state) => {
    if (!state.currentSession) return state;
    
    return {
      currentSession: {
        ...state.currentSession,
        messages: []
      }
    };
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

  // Workflow state
  workflowState: null,
  setWorkflowState: (state) => set({ workflowState: state }),
  
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
    set({ isLoading: true });
    try {
      const chat = await api.get<ChatSession>(`/chat/history/${chatId}`);
      // Convert date strings back to Date objects
      const chatSession: ChatSession = {
        ...chat,
        id: (chat as any)._id ?? chat.id,
        name: chat.name || 'New Chat', // Ensure we have a name
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        messages: (chat.messages ?? []).map((msg: any) => {
          const ts = new Date(msg.timestamp);
          if (msg.role === 'assistant') ts.setHours(ts.getHours() + 7);
          return { ...msg, timestamp: ts };
        })
      };

      // If chat has no name but has messages, use first user message as name
      if (chatSession.name === 'New Chat' && chatSession.messages.length > 0) {
        const firstUserMessage = chatSession.messages.find(msg => msg.role === 'user');
        if (firstUserMessage) {
          chatSession.name = firstUserMessage.content.slice(0, 20);
        }
      }

      set({ currentSession: chatSession });

      // Also update the chat in history
      set((state) => ({
        chatHistory: state.chatHistory.map(chat =>
          chat.id === chatId ? chatSession : chat
        )
      }));

      return true;
    } catch (error) {
      console.error('Failed to load chat:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  saveChat: async () => {
    const { currentSession } = get();
    if (!currentSession) return;
    
    try {
      // API call now handles headers and token
      await api.post('/chat/save', currentSession);
      
      // Update chat history with saved chat
      const { chatHistory } = get();
      const existingIndex = chatHistory.findIndex(chat => chat.id === currentSession.id);
      
      if (existingIndex >= 0) {
        // Update existing chat
        const updatedHistory = [...chatHistory];
        updatedHistory[existingIndex] = currentSession;
        set({ chatHistory: updatedHistory });
      } else {
        // Add new chat to history
        set((state) => ({
          chatHistory: [currentSession, ...state.chatHistory]
        }));
      }
    } catch (error) {
      console.error('Failed to save chat:', error);
    }
  },
  
  // Fetch recent chats from backend
  fetchChatHistory: async (force = false) => {
    if (!force && get().chatHistory.length > 0) {
      return;
    }
    try {
      const chats = await api.get<ChatSession[]>('/chat/history');
      const chatSessions: ChatSession[] = chats
        .filter((c: any) => c._id && c._id.length === 24)
        .map((chat: any) => {
          // Find first user message if name is "New Chat"
          let chatName = chat.name || 'New Chat';
          if (chatName === 'New Chat' && chat.messages && chat.messages.length > 0) {
            const firstUserMessage = chat.messages.find((msg: any) => msg.role === 'user');
            if (firstUserMessage) {
              chatName = firstUserMessage.content.slice(0, 20);
            }
          }

          return {
            ...chat,
            id: chat._id ?? chat.id,
            name: chatName,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt),
            messages: (chat.messages ?? []).map((msg: any) => {
              const ts = new Date(msg.timestamp);
              if (msg.role === 'assistant') ts.setHours(ts.getHours() + 7);
              return { ...msg, timestamp: ts };
            })
          };
        });
      set({ chatHistory: chatSessions });
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  },
  
  // Delete chat
  deleteChat: async (chatId: string) => {
    try {
      await api.delete(`/chat/${chatId}`);
      
      set((state) => ({
        chatHistory: state.chatHistory.filter(chat => chat.id !== chatId),
        currentSession: state.currentSession?.id === chatId ? null : state.currentSession
      }));
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  },
  
  pinChat: async (chatId, pinned) => {
    try {
      // Update pin state in backend
      await api.post(`/chat/${chatId}/pin`, { isPinned: pinned });

      // Update local state
      set((state) => ({
        chatHistory: state.chatHistory.map(chat =>
          chat.id === chatId ? { ...chat, isPinned: pinned } : chat
        ),
        // Also update current session if it's the same chat
        currentSession: state.currentSession?.id === chatId
          ? { ...state.currentSession, isPinned: pinned }
          : state.currentSession
      }));
    } catch (error) {
      console.error('Failed to pin chat:', error);
    }
  },

  // Enhanced history actions
  fetchChatHistoryFiltered: async (filters = {}, page = 1, limit = 50) => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      });

      const response = await api.get<{
        conversations: ChatSession[];
        pagination: ChatHistoryPagination;
        filters: ChatHistoryFilters;
      }>(`/chat/history?${queryParams}`);

      const chatSessions: ChatSession[] = response.conversations.map((chat: any) => ({
        ...chat,
        id: chat.id || chat._id,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        messages: (chat.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));

      set({
        chatHistory: chatSessions,
        historyPagination: response.pagination,
        historyFilters: filters
      });
    } catch (error) {
      console.error('Failed to fetch filtered chat history:', error);
    }
  },

  searchConversations: async (query: string) => {
    try {
      const response = await api.get<{
        messages: any[];
        query: string;
        total: number;
      }>(`/chat/search?query=${encodeURIComponent(query)}&limit=20`);

      return response.messages;
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return [];
    }
  },

  exportConversations: async (conversationIds: string[], format = 'json') => {
    try {
      const response = await fetch('/api/chat/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ conversationIds, format })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `conversations.${format}`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export conversations:', error);
      throw error;
    }
  },

  bulkOperations: async (action: 'delete' | 'archive' | 'pin' | 'unpin', conversationIds: string[]) => {
    try {
      await api.post('/chat/bulk', {
        action,
        conversationIds
      });

      // Update local state based on action
      set((state) => {
        let updatedHistory = [...state.chatHistory];

        switch (action) {
          case 'delete':
            updatedHistory = updatedHistory.filter(chat => !conversationIds.includes(chat.id));
            break;
          case 'pin':
            updatedHistory = updatedHistory.map(chat =>
              conversationIds.includes(chat.id) ? { ...chat, isPinned: true } : chat
            );
            break;
          case 'unpin':
            updatedHistory = updatedHistory.map(chat =>
              conversationIds.includes(chat.id) ? { ...chat, isPinned: false } : chat
            );
            break;
          case 'archive':
            // For now, just remove from current view
            updatedHistory = updatedHistory.filter(chat => !conversationIds.includes(chat.id));
            break;
        }

        return {
          chatHistory: updatedHistory,
          currentSession: action === 'delete' && conversationIds.includes(state.currentSession?.id || '')
            ? null
            : state.currentSession
        };
      });
    } catch (error) {
      console.error(`Failed to perform bulk ${action}:`, error);
      throw error;
    }
  },

  fetchAnalytics: async (dateFrom?: string, dateTo?: string, agentId?: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.set('dateFrom', dateFrom);
      if (dateTo) queryParams.set('dateTo', dateTo);
      if (agentId) queryParams.set('agentId', agentId);

      const analytics = await api.get<ChatAnalytics>(`/chat/analytics?${queryParams}`);
      set({ analytics });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  }
}));

export default useChatStore; 