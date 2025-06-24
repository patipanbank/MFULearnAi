import React, { useState } from 'react';
import { FiSearch, FiClock, FiFileText } from 'react-icons/fi';

const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    // TODO: Implement actual search API call
    setTimeout(() => {
      setSearchResults([
        {
          id: 1,
          title: 'Sample Search Result 1',
          content: 'This is a sample search result content...',
          type: 'document',
          timestamp: new Date().toISOString()
        },
        {
          id: 2,
          title: 'Sample Search Result 2',
          content: 'Another sample search result with different content...',
          type: 'chat',
          timestamp: new Date().toISOString()
        }
      ]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex-1 bg-primary overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-primary px-6 py-4">
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

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {searchResults.length === 0 && !isLoading && searchQuery && (
            <div className="text-center py-12">
              <FiSearch className="h-12 w-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary mb-2">No results found</h3>
              <p className="text-muted">Try adjusting your search terms or filters</p>
            </div>
          )}

          {searchResults.length === 0 && !searchQuery && (
            <div className="text-center py-12">
              <FiSearch className="h-12 w-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary mb-2">Search Chat History</h3>
              <p className="text-muted">Search through your chat history</p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted">Searching...</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Found {searchResults.length} results for "{searchQuery}"
              </p>
              
              {searchResults.map((result) => (
                <div key={result.id} className="card p-6 card-hover">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {result.type === 'document' ? (
                        <FiFileText className="h-5 w-5 text-blue-600" />
                      ) : (
                        <FiClock className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-primary mb-2">
                        {result.title}
                      </h3>
                      <p className="text-secondary mb-3 line-clamp-3">
                        {result.content}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-muted">
                        <span className="capitalize">{result.type}</span>
                        <span>•</span>
                        <span>{new Date(result.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage; 