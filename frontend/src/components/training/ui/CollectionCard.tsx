import React from 'react';
import { FaFileAlt } from 'react-icons/fa';
import { CollectionExtended } from '../utils/types';

interface CollectionCardProps {
  collection: CollectionExtended;
  onClick: (collection: CollectionExtended) => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick }) => {
  const { name, documentCount = 0, lastModified } = collection;
  
  const formattedDate = new Date(lastModified || '').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div 
      onClick={() => onClick(collection)}
      className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md 
      border border-gray-200 dark:border-gray-700 p-5 cursor-pointer transition-all 
      duration-300 hover:transform hover:scale-[1.02]"
    >
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 
        line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 
        transition-colors duration-200">
          {name}
        </h3>
        
        {collection.isPrivate && (
          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 
          text-xs font-medium px-2.5 py-0.5 rounded-full">
            Private
          </span>
        )}
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center text-gray-500 dark:text-gray-400">
          <FaFileAlt className="mr-1.5" />
          <span className="text-sm">
            {documentCount} Document{documentCount !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Updated {formattedDate}
        </div>
      </div>
    </div>
  );
}; 