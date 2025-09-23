import React, { useState, useEffect } from 'react';
import {
  FiSearch,
  FiFilter,
  FiTrash2,
  FiArchive,
  FiBookmark,
  FiChevronLeft,
  FiChevronRight,
  FiBarChart
} from 'react-icons/fi';
import { useChatStore } from '../../stores';
import { formatDate } from '../../lib/utils';

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ isOpen, onClose }) => {
  const {
    chatHistory,
    historyFilters,
    historyPagination,
    analytics,
    setHistoryFilters,
    fetchChatHistoryFiltered,
    searchConversations,
    exportConversations,
    bulkOperations,
    fetchAnalytics
  } = useChatStore();

  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pinnedFilter, setPinnedFilter] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchChatHistoryFiltered(historyFilters, 1, 50);
      fetchAnalytics();
    }
  }, [isOpen, fetchChatHistoryFiltered, fetchAnalytics]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchConversations(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyFilters = () => {
    const filters = {
      search: searchQuery || undefined,
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      pinned: pinnedFilter ? pinnedFilter === 'true' : undefined
    };

    setHistoryFilters(filters);
    fetchChatHistoryFiltered(filters, 1, historyPagination.limit);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setPinnedFilter('');
    setSearchQuery('');
    setHistoryFilters({});
    fetchChatHistoryFiltered({}, 1, historyPagination.limit);
  };

  const handleSelectChat = (chatId: string, checked: boolean) => {
    if (checked) {
      setSelectedChats(prev => [...prev, chatId]);
    } else {
      setSelectedChats(prev => prev.filter(id => id !== chatId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedChats(chatHistory.map(chat => chat.id));
    } else {
      setSelectedChats([]);
    }
  };

  const handleBulkAction = async (action: 'delete' | 'archive' | 'pin' | 'unpin') => {
    if (selectedChats.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${selectedChats.length} conversation(s)?`
    );

    if (confirmed) {
      try {
        await bulkOperations(action, selectedChats);
        setSelectedChats([]);
        // Refresh the list
        fetchChatHistoryFiltered(historyFilters, historyPagination.page, historyPagination.limit);
      } catch (error) {
        console.error(`Bulk ${action} failed:`, error);
      }
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'markdown') => {
    const chatsToExport = selectedChats.length > 0 ? selectedChats : chatHistory.map(chat => chat.id);

    try {
      await exportConversations(chatsToExport, format);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handlePageChange = (page: number) => {
    fetchChatHistoryFiltered(historyFilters, page, historyPagination.limit);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold text-primary">Chat History</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="btn-ghost px-3 py-2 text-sm"
            >
              <FiBarChart className="h-4 w-4 mr-2" />
              Analytics
            </button>
            <button onClick={onClose} className="btn-ghost px-3 py-2">
              ✕
            </button>
          </div>
        </div>

        {/* Analytics Panel */}
        {showAnalytics && analytics && (
          <div className="p-6 bg-secondary/30 border-b">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-background p-4 rounded-lg">
                <div className="text-2xl font-bold text-primary">{analytics.summary.totalConversations}</div>
                <div className="text-sm text-muted">Total Conversations</div>
              </div>
              <div className="bg-background p-4 rounded-lg">
                <div className="text-2xl font-bold text-primary">{analytics.summary.totalMessages}</div>
                <div className="text-sm text-muted">Total Messages</div>
              </div>
              <div className="bg-background p-4 rounded-lg">
                <div className="text-2xl font-bold text-primary">{analytics.summary.totalTokens.toLocaleString()}</div>
                <div className="text-sm text-muted">Total Tokens</div>
              </div>
              <div className="bg-background p-4 rounded-lg">
                <div className="text-2xl font-bold text-primary">{Math.round(analytics.summary.averageResponseTime)}ms</div>
                <div className="text-sm text-muted">Avg Response Time</div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="p-6 border-b space-y-4">
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="btn-primary px-4 py-2"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-ghost px-4 py-2"
            >
              <FiFilter className="h-4 w-4" />
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-secondary/30 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Pinned</label>
                  <select
                    value={pinnedFilter}
                    onChange={(e) => setPinnedFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  >
                    <option value="">All</option>
                    <option value="true">Pinned Only</option>
                    <option value="false">Not Pinned</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-2">
                <button onClick={handleApplyFilters} className="btn-primary px-4 py-2">
                  Apply Filters
                </button>
                <button onClick={handleClearFilters} className="btn-ghost px-4 py-2">
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedChats.length > 0 && (
            <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm text-secondary">
                {selectedChats.length} conversation(s) selected
              </span>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleBulkAction('pin')}
                  className="btn-ghost px-2 py-1 text-sm"
                  title="Pin selected"
                >
                  <FiBookmark className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleBulkAction('archive')}
                  className="btn-ghost px-2 py-1 text-sm"
                  title="Archive selected"
                >
                  <FiArchive className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="btn-ghost px-2 py-1 text-sm text-red-600"
                  title="Delete selected"
                >
                  <FiTrash2 className="h-3 w-3" />
                </button>
                <div className="border-l border-border mx-2"></div>
                <button
                  onClick={() => handleExport('json')}
                  className="btn-ghost px-2 py-1 text-sm"
                  title="Export as JSON"
                >
                  JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="btn-ghost px-2 py-1 text-sm"
                  title="Export as CSV"
                >
                  CSV
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="btn-ghost px-2 py-1 text-sm"
                  title="Export as Markdown"
                >
                  MD
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {searchResults.length > 0 ? (
            /* Search Results */
            <div className="p-6">
              <h3 className="text-lg font-medium text-primary mb-4">
                Search Results ({searchResults.length})
              </h3>
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div key={result.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-primary">{result.conversationTitle}</span>
                      <span className="text-sm text-muted">{formatDate(new Date(result.createdAt))}</span>
                    </div>
                    <div className="text-sm text-secondary">
                      {result.role}: {result.content.slice(0, 200)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Chat History List */
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-medium text-primary">
                    Conversations ({historyPagination.total})
                  </h3>
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedChats.length === chatHistory.length && chatHistory.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>Select All</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                {chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChats.includes(chat.id)}
                      onChange={(e) => handleSelectChat(chat.id, e.target.checked)}
                      className="rounded border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        {chat.isPinned && <FiBookmark className="h-3 w-3 text-blue-500" />}
                        <span className="font-medium text-primary truncate">{chat.name}</span>
                      </div>
                      <div className="text-sm text-muted">
                        {formatDate(chat.updatedAt)} • {chat.messages.length} messages
                      </div>
                    </div>
                    <div className="text-sm text-muted">
                      {chat.agentId && (
                        <span className="px-2 py-1 bg-secondary/50 rounded text-xs">
                          {chat.agentId}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {historyPagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted">
                    Page {historyPagination.page} of {historyPagination.pages}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(historyPagination.page - 1)}
                      disabled={historyPagination.page === 1}
                      className="btn-ghost px-3 py-2 disabled:opacity-50"
                    >
                      <FiChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(historyPagination.page + 1)}
                      disabled={historyPagination.page === historyPagination.pages}
                      className="btn-ghost px-3 py-2 disabled:opacity-50"
                    >
                      <FiChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistoryModal;