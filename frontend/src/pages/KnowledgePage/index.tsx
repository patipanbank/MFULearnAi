import React, { useEffect, useState } from 'react';
import { FiDatabase, FiRefreshCcw, FiPlus, FiSearch } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';
import CreateCollectionModal from './CreateCollectionModal';
import CollectionDetailModal from './CollectionDetailModal';

interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
}

const KnowledgePage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const { addToast } = useUIStore();

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      // Attempt to fetch user-accessible collections first
      const loaded = await api.get<Collection[]>('/collections/');
      setCollections(loaded);
    } catch (err: unknown) {
      console.warn('Failed to load private collections:', err);
      // If request fails (e.g. unauthenticated), try public collections
      try {
        const publicCollections = await api.get<Collection[]>('/collections/public/');
        setCollections(publicCollections);
        addToast({
          type: 'warning',
          title: 'Limited Access',
          message: 'Showing public collections only. Please log in to access private collections.'
        });
      } catch (publicErr: unknown) {
        console.error('Failed to load collections:', publicErr);
        setCollections([]);
        addToast({
          type: 'error',
          title: 'Load Failed',
          message: 'Unable to load knowledge collections.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const filteredCollections = collections.filter(col => col.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        <div className="flex-1 max-w-md relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
          <input
            type="text"
            placeholder="Search collections..."
            className="input pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCollections}
            className="btn-ghost flex items-center space-x-2"
          >
            <FiRefreshCcw className="h-4 w-4" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <FiPlus className="h-4 w-4" />
            <span>New Collection</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-secondary">Loading collections...</span>
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-12">
          <FiDatabase className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No collections available</h3>
          <p className="text-muted">Create a collection via the API or admin panel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((col) => (
            <div
              key={col.id}
              className="card card-hover p-4 flex items-start space-x-3 cursor-pointer"
              onClick={() => setSelectedCollection(col)}
            >
              <FiDatabase className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-primary">{col.name}</h4>
                <p className="text-xs text-secondary mt-1">
                  {col.createdBy} • {col.permission}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateCollectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(newCol) => setCollections((prev) => [...prev, newCol])}
      />

      <CollectionDetailModal
        isOpen={!!selectedCollection}
        collection={selectedCollection}
        onClose={() => setSelectedCollection(null)}
      />
    </div>
  );
};

export default KnowledgePage; 