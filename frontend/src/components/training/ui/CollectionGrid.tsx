import React from 'react';
import { CollectionExtended } from '../utils/types';
import { CollectionCard } from './CollectionCard';
import { EmptyState } from './EmptyState';

interface CollectionGridProps {
  collections: CollectionExtended[];
  onCollectionClick: (collection: CollectionExtended) => void;
  loading: boolean;
  searchQuery: string;
  onNewCollectionToggle: () => void;
}

export const CollectionGrid: React.FC<CollectionGridProps> = ({
  collections,
  onCollectionClick,
  loading,
  searchQuery,
  onNewCollectionToggle,
}) => {
  // If loading, show skeleton loaders
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, index) => (
          <div
            key={index}
            className="bg-gray-100 dark:bg-gray-800/50 animate-pulse rounded-xl p-5 h-[140px]"
          >
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
            <div className="flex items-center justify-between">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Filter collections based on the search query
  const filteredCollections = searchQuery
    ? collections.filter((collection) =>
        collection.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : collections;

  // If no collections or no filtered collections, show empty state
  if (filteredCollections.length === 0) {
    if (searchQuery) {
      return (
        <EmptyState
          title="No collections found"
          description={`No collections matching "${searchQuery}". Try a different search term or create a new collection.`}
          action={{
            label: "Create Collection",
            onClick: onNewCollectionToggle,
          }}
        />
      );
    }
    
    return (
      <EmptyState
        title="No collections yet"
        description="Create your first collection to start organizing your training documents."
        action={{
          label: "Create Collection",
          onClick: onNewCollectionToggle,
        }}
      />
    );
  }

  // Render the grid of collections
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredCollections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onClick={onCollectionClick}
        />
      ))}
    </div>
  );
}; 