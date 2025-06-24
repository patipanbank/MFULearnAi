import React, { useState, useEffect } from 'react';
import { FiSearch, FiClock, FiFileText, FiMessageSquare } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import type { AxiosResponse } from 'axios';

interface ChatMessage {
  id: string;
  content: string;
  role: string;
  timestamp: string;
}

const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response: AxiosResponse<ChatMessage[]> = await api.get('/chat/history');
      setChatHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
    setIsLoadingHistory(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response: AxiosResponse<ChatMessage[]> = await api.get(`/chat/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
            {/* Search Results */}
            {searchQuery && (
              <>
                {isLoading && (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-muted">Searching...</p>
                  </div>
                )}

                {!isLoading && searchResults.length === 0 && (
                  <div className="text-center py-12">
                    <FiSearch className="h-12 w-12 text-muted mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-primary mb-2">No results found</h3>
                    <p className="text-muted">Try adjusting your search terms</p>
                  </div>
                )}

                {!isLoading && searchResults.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted">
                      Found {searchResults.length} results for "{searchQuery}"
                    </p>
                    {searchResults.map((result) => (
                      <div key={result.id} className="card p-6 card-hover">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <FiMessageSquare className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-secondary mb-3">{result.content}</p>
                            <div className="flex items-center space-x-4 text-sm text-muted">
                              <span>{result.role}</span>
                              <span>•</span>
                              <span>{formatDate(result.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Chat History */}
            {!searchQuery && (
              <>
                {isLoadingHistory ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-muted">Loading chat history...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-primary mb-4">Recent Chat History</h2>
                    {chatHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <FiMessageSquare className="h-12 w-12 text-muted mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-primary mb-2">No chat history</h3>
                        <p className="text-muted">Start a new chat to see your history here</p>
                      </div>
                    ) : (
                      chatHistory.map((message) => (
                        <div key={message.id} className="card p-6 card-hover">
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                              <FiMessageSquare className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-secondary mb-3">{message.content}</p>
                              <div className="flex items-center space-x-4 text-sm text-muted">
                                <span>{message.role}</span>
                                <span>•</span>
                                <span>{formatDate(message.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage; 