import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';

interface ChatHistory {
  _id: string;
  chatname: string;
  modelId: string;
  folder: string;
  tags: string[];
  isPinned: boolean;
  messages: Message[];
  lastUpdated: Date;
  createdAt: Date;
}

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatManagerProps {
  onSelectChat: (chat: ChatHistory) => void;
  onCreateNewChat: () => void;
  selectedChatId?: string;
}

const ChatManager: React.FC<ChatManagerProps> = ({ onSelectChat, onCreateNewChat, selectedChatId }) => {
  const [chats, setChats] = useState<ChatHistory[]>([]);
  const [folders, setFolders] = useState<string[]>(['default']);
  const [selectedFolder, setSelectedFolder] = useState<string>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  useEffect(() => {
    loadChats();
  }, [selectedFolder, searchQuery]);

  const loadChats = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

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
        setChats(data);
        
        // Extract unique folders
        const uniqueFolders = [...new Set(data.map(chat => chat.folder || 'default'))];
        setFolders(['default', ...uniqueFolders.filter(f => f !== 'default')]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const handleRename = async (chatId: string, newName: string) => {
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
        await loadChats();
        setIsRenaming(null);
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const handleDelete = async (chatId: string) => {
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
        await loadChats();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleMoveToFolder = async (chatId: string, folder: string) => {
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
        await loadChats();
      }
    } catch (error) {
      console.error('Error moving chat:', error);
    }
  };

  const handleTogglePin = async (chatId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}/toggle-pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadChats();
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleExport = async (chatId: string) => {
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
  };

  // Sort and filter chats
  const filteredAndSortedChats = chats
    .filter(chat => {
      const matchesSearch = chat.chatname.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPinned = showPinnedOnly ? chat.isPinned : true;
      return matchesSearch && matchesPinned;
    })
    .sort((a, b) => {
      // First sort by pinned status
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      
      // Then sort by selected criteria
      if (sortBy === 'date') {
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      } else {
        return a.chatname.localeCompare(b.chatname);
      }
    });

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Header Section */}
      <div className="p-4 border-b dark:border-gray-700 space-y-4">
        {/* Search and New Chat */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full px-4 py-2 pl-10 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>
          <button
            onClick={onCreateNewChat}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <span>+</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Filters and Sort */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
              className="px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinnedOnly"
              checked={showPinnedOnly}
              onChange={(e) => setShowPinnedOnly(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="pinnedOnly" className="text-sm text-gray-600 dark:text-gray-300">
              Show pinned only
            </label>
          </div>
        </div>

        {/* Folders */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {folders.map(folder => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors
                ${selectedFolder === folder
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              {folder}
            </button>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedChats.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No chats found
          </div>
        ) : (
          filteredAndSortedChats.map(chat => (
            <div
              key={chat._id}
              className={`p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                ${selectedChatId === chat._id ? 'bg-blue-50 dark:bg-gray-700' : ''}
              `}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left side: Pin and Chat Name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => handleTogglePin(chat._id)}
                    className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors
                      ${chat.isPinned ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}
                    `}
                    title={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
                  >
                    📌
                  </button>
                  
                  {isRenaming === chat._id ? (
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(chat._id, newName);
                        if (e.key === 'Escape') setIsRenaming(null);
                      }}
                      className="flex-1 px-2 py-1 border rounded dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => onSelectChat(chat)}
                      className="flex-1 text-left truncate hover:text-blue-500 dark:text-white dark:hover:text-blue-400"
                      title={chat.chatname}
                    >
                      {chat.chatname}
                    </button>
                  )}
                </div>

                {/* Right side: Actions */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(chat.lastUpdated)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsRenaming(chat._id)}
                      className="p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Rename chat"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleExport(chat._id)}
                      className="p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Export chat"
                    >
                      📤
                    </button>
                    <button
                      onClick={() => handleDelete(chat._id)}
                      className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                    <button
                      onClick={() => handleMoveToFolder(chat._id, selectedFolder)}
                      className="p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Move to folder"
                    >
                      📁
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatManager; 