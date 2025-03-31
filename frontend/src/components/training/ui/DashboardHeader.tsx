import React from 'react';
import { FaPlus } from 'react-icons/fa';

interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewCollectionToggle: () => void;
  loading: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewCollectionToggle,
  loading
}) => (
  <header className="mb-8">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Training Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your training collections and documents
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
              placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
            disabled={loading}
          />
        </div>
        <button
          onClick={onNewCollectionToggle}
          className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 
            hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200
            transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed
            shadow-md hover:shadow-lg"
          disabled={loading}
        >
          <FaPlus className="mr-2" />
          {loading ? 'Loading...' : 'New Collection'}
        </button>
      </div>
    </div>
  </header>
); 