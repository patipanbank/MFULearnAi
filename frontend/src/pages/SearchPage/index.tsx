import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiClock, FiFileText, FiBookmark } from 'react-icons/fi';
import { useChatStore } from '../../shared/stores';
import { cn } from '../../shared/lib/utils';

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { 
    chatHistory, 
    currentSession, 
    fetchChatHistory, 
    loadChat, 
    deleteChat, 
    pinChat 
  } = useChatStore();

  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    // TODO: Implement actual search API call
    setTimeout(() => {
      const filteredChats = chatHistory.filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filteredChats);
      setIsLoading(false);
    }, 300);
  };

  // Sort chats: pinned first, then by updatedAt
  const sortedChats = [...chatHistory].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Add function to format date with Thailand timezone
  const formatThaiDate = (date: Date | string) => {
    const d = new Date(date);
    d.setHours(d.getHours() + 7); // Add 7 hours for Thailand timezone
    return d.toLocaleDateString('th-TH');
  };

  const handleChatClick = async (chatId: string) => {
    const ok = await loadChat(chatId);
    if (ok) {
      navigate(`/chat/${chatId}`);
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this chat?')) {
      await deleteChat(chatId);
    }
  };

  const handlePinChat = async (e: React.MouseEvent, chatId: string, isPinned: boolean | undefined) => {
    e.stopPropagation();
    pinChat(chatId, !isPinned);
  };

  return (
    <div className="flex-1 bg-primary overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-primary px-6 py-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-primary mb-4">Search Chat History</h1>
            
            {/* Search Form */}
            <form onSubmit={handleSearch} className="flex space-x-4">
              <div className="flex-1 relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-5 w-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for chats"
                  className="input pl-10 w-full"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                className="btn-primary px-6"
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {searchResults.length === 0 && !isLoading && searchQuery && (
              <div className="text-center py-12">
                <FiSearch className="h-12 w-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-primary mb-2">No results found</h3>
                <p className="text-muted">Try adjusting your search terms</p>
              </div>
            )}

            {searchResults.length === 0 && !searchQuery && (
              <div className="space-y-2">
                {sortedChats.length === 0 ? (
                  <div className="text-sm text-muted text-center py-8">
                    No chats yet. Start a new conversation!
                  </div>
                ) : (
                  sortedChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleChatClick(chat.id)}
                      className={cn(
                        'group relative flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer',
                        currentSession?.id === chat.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          : 'text-secondary card-hover'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          {chat.isPinned && (
                            <FiBookmark className="h-4 w-4 text-muted flex-shrink-0" />
                          )}
                          <span className="truncate font-medium text-base">
                            {chat.name}
                          </span>
                        </div>
                        <div className="text-sm text-muted mt-1">
                          {formatThaiDate(chat.updatedAt)}
                        </div>
                      </div>
                      
                      {/* Chat Actions */}
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handlePinChat(e, chat.id, chat.isPinned)}
                          className="p-1 text-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
                        >
                          <FiBookmark className={cn(
                            'h-4 w-4',
                            chat.isPinned && 'fill-current'
                          )} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted">Searching...</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted mb-4">
                  Found {searchResults.length} results for "{searchQuery}"
                </p>
                
                {searchResults.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleChatClick(chat.id)}
                    className={cn(
                      'group relative flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer',
                      currentSession?.id === chat.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        : 'text-secondary card-hover'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        {chat.isPinned && (
                          <FiBookmark className="h-4 w-4 text-muted flex-shrink-0" />
                        )}
                        <span className="truncate font-medium text-base">
                          {chat.name}
                        </span>
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {formatThaiDate(chat.updatedAt)}
                      </div>
                    </div>
                    
                    {/* Chat Actions */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handlePinChat(e, chat.id, chat.isPinned)}
                        className="p-1 text-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
                      >
                        <FiBookmark className={cn(
                          'h-4 w-4',
                          chat.isPinned && 'fill-current'
                        )} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage; 