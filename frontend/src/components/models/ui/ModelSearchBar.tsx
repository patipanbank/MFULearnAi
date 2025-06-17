import React, { useState } from 'react';
import { FaSearch, FaFilter, FaTimes } from 'react-icons/fa';

interface ModelSearchBarProps {
  onSearch: (query: string, filters: any) => void;
  isLoading?: boolean;
}

export const ModelSearchBar: React.FC<ModelSearchBarProps> = ({
  onSearch,
  isLoading = false
}) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    modelType: '',
    department: ''
  });

  const handleSearch = () => {
    onSearch(query, filters);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setFilters({
      modelType: '',
      department: ''
    });
    setQuery('');
    onSearch('', {});
  };

  const hasActiveFilters = query || filters.modelType || filters.department;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search models by name, description, or collections..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 
              rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
              dark:bg-gray-700 dark:text-white placeholder-gray-400"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 
            rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
            ${showFilters ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600' : ''}`}
        >
          <FaFilter className="h-4 w-4 mr-2" />
          Filters
        </button>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 
            text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Searching...
            </>
          ) : (
            <>
              <FaSearch className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center px-3 py-2 text-gray-600 dark:text-gray-400 
              hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 
              dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 
              transition-colors"
          >
            <FaTimes className="h-4 w-4 mr-2" />
            Clear
          </button>
        )}
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Model Type
              </label>
              <select
                value={filters.modelType}
                onChange={(e) => setFilters({ ...filters, modelType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                  rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                  dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="personal">Personal</option>
                <option value="department">Department</option>
                <option value="official">Official</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Department
              </label>
              <input
                type="text"
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                placeholder="Enter department name..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                  rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                  dark:bg-gray-700 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSearchBar; 