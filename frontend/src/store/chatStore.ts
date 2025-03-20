import { create } from 'zustand';
import { config } from '../config/config';

export interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatHistory {
  _id: string;
  chatname: string;
  modelId: string;
  folder: string;
  tags: string[];
  isPinned: boolean;
  messages: Message[];
  lastUpdated: Date;
}

interface ChatState {
  chats: ChatHistory[];
  folders: string[];
  selectedFolder: string;
  selectedChatId: string | null;
  searchQuery: string;
  isCreatingChat: boolean;
  isRenaming: string | null;
  newName: string;
  
  // Actions
  setSelectedFolder: (folder: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedChatId: (id: string | null) => void;
  setIsCreatingChat: (isCreating: boolean) => void;
  setIsRenaming: (chatId: string | null) => void;
  setNewName: (name: string) => void;
  
  // API Actions
  loadChats: () => Promise<void>;
  createNewChat: () => Promise<void>;
  renameChat: (chatId: string, newName: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  moveToFolder: (chatId: string, folder: string) => Promise<void>;
  togglePin: (chatId: string) => Promise<void>;
  exportChat: (chatId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  folders: ['default'],
  selectedFolder: 'default',
  selectedChatId: null,
  searchQuery: '',
  isCreatingChat: false,
  isRenaming: null,
  newName: '',

  // Setters
  setSelectedFolder: (folder) => set({ selectedFolder: folder }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedChatId: (id) => set({ selectedChatId: id }),
  setIsCreatingChat: (isCreating) => set({ isCreatingChat: isCreating }),
  setIsRenaming: (chatId) => set({ isRenaming: chatId }),
  setNewName: (name) => set({ newName: name }),

  // API Actions
  loadChats: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const { selectedFolder, searchQuery } = get();
      const queryParams = new URLSearchParams();
      if (selectedFolder) queryParams.append('folder', selectedFolder);
      if (searchQuery) queryParams.append('search', searchQuery);

      const response = await fetch(`${config.apiUrl}/api/chat/history?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json() as ChatHistory[];
        set({ 
          chats: data,
          folders: ['default', ...new Set(data.map(chat => chat.folder || 'default'))]
        });
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  },

  createNewChat: async () => {
    const { isCreatingChat } = get();
    if (isCreatingChat) return;

    try {
      set({ isCreatingChat: true });
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await get().loadChats();
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      set({ isCreatingChat: false });
    }
  },

  renameChat: async (chatId: string, newName: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newName })
      });

      if (response.ok) {
        await get().loadChats();
        set({ isRenaming: null });
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  },

  deleteChat: async (chatId: string) => {
    if (!window.confirm('Are you sure you want to delete this chat?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await get().loadChats();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  },

  moveToFolder: async (chatId: string, folder: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}/folder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ folder })
      });

      if (response.ok) {
        await get().loadChats();
      }
    } catch (error) {
      console.error('Error moving chat:', error);
    }
  },

  togglePin: async (chatId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}/toggle-pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await get().loadChats();
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  },

  exportChat: async (chatId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${chatId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting chat:', error);
    }
  }
})); 