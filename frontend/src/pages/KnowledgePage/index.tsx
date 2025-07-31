import React, { useEffect, useState } from 'react';
import { FiDatabase, FiRefreshCcw, FiPlus, FiSearch, FiFolder, FiFile, FiUpload } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';
import CreateCollectionModal from './CreateCollectionModal';
import CollectionDetailModal from './CollectionDetailModal';
import UploadDocumentsModal from './UploadDocumentsModal';
import EditCollectionModal from './EditCollectionModal';
import CollectionCard from './CollectionCard';

interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
}

const KnowledgePage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalCollections: 0,
    totalDocuments: 0,
    totalSize: 0
  });
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useUIStore();

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      // Attempt to fetch user-accessible collections first
      const userCollections = await api.get<Collection[]>('/collections/');
      setCollections(userCollections);
      
      // Fetch analytics
      const analyticsData = await api.get<{
        totalCollections: number;
        totalDocuments: number;
        totalSize: number;
      }>('/collections/analytics');
      setAnalytics(analyticsData);
    } catch (error: any) {
      console.error('Error fetching collections:', error);
      setError(error.message || 'Failed to load collections');
      addToast({
        type: 'error',
        title: 'Failed to load collections',
        message: 'Please try refreshing the page.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionCreated = (newCol: Collection) => {
    setCollections((prev) => [...prev, newCol]);
    setShowCreateModal(false);
  };

  const handleCollectionUpdated = (updatedCol: Collection) => {
    setCollections((prev) => 
      prev.map(col => col.id === updatedCol.id ? updatedCol : col)
    );
    setShowEditModal(false);
  };

  const handleCollectionDeleted = (deletedCol: Collection) => {
    setCollections((prev) => prev.filter(col => col.id !== deletedCol.id));
    setShowEditModal(false);
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const filteredCollections = collections.filter(col => col.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Knowledge Base</h1>
        <p className="text-secondary text-base mt-1">Manage your document collections and training data</p>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FiFolder className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-secondary">Total Collections</p>
              <p className="text-2xl font-bold text-primary">{analytics.totalCollections}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FiFile className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-secondary">Total Documents</p>
              <p className="text-2xl font-bold text-primary">{analytics.totalDocuments}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FiDatabase className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-secondary">Total Size</p>
              <p className="text-2xl font-bold text-primary">{formatBytes(analytics.totalSize)}</p>
            </div>
          </div>
        </div>
      </div>

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
            className="btn-secondary flex items-center space-x-2"
          >
            <FiRefreshCcw className="h-4 w-4" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <FiUpload className="h-4 w-4" />
            <span>Upload Documents</span>
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

      {/* Results Count */}
      {!loading && !error && (
        <div className="mb-4">
          <p className="text-sm text-secondary">
            {searchQuery 
              ? `Found ${filteredCollections.length} collection${filteredCollections.length !== 1 ? 's' : ''} matching "${searchQuery}"`
              : `Showing ${filteredCollections.length} collection${filteredCollections.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="card p-6 animate-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="bg-red-100 dark:bg-red-900/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <FiDatabase className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-primary mb-2">Failed to load collections</h3>
          <p className="text-secondary mb-6 max-w-md mx-auto">
            {error}
          </p>
          <button
            onClick={fetchCollections}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <FiRefreshCcw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onView={(collection) => {
                setSelectedCollection(collection);
                setShowDetailModal(true);
              }}
              onUpload={(collection) => {
                setSelectedCollection(collection);
                setShowUploadModal(true);
              }}
              onEdit={(collection) => {
                setSelectedCollection(collection);
                setShowEditModal(true);
              }}
              onDelete={async (collection) => {
                if (window.confirm(`Are you sure you want to delete "${collection.name}"? This action cannot be undone.`)) {
                  try {
                    await api.delete(`/collections/${collection.id}`);
                    handleCollectionDeleted(collection);
                    addToast({
                      type: 'success',
                      title: 'Collection Deleted',
                      message: 'Collection has been deleted successfully.'
                    });
                  } catch (error: any) {
                    addToast({
                      type: 'error',
                      title: 'Delete Failed',
                      message: error.message || 'Failed to delete collection.'
                    });
                  }
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredCollections.length === 0 && !loading && !error && (
        <div className="text-center py-12">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <FiFolder className="h-10 w-10 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-primary mb-2">
            {searchQuery ? 'No collections found' : 'No collections yet'}
          </h3>
          <p className="text-secondary mb-6 max-w-md mx-auto">
            {searchQuery 
              ? 'Try adjusting your search terms or create a new collection that matches your criteria.'
              : 'Collections help you organize and manage your documents for AI training. Create your first collection to get started.'
            }
          </p>
          <div className="flex items-center justify-center space-x-3">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="btn-secondary"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <FiPlus className="h-4 w-4" />
                <span>Create Collection</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateCollectionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCollectionCreated}
        />
      )}

      {showDetailModal && selectedCollection && (
        <CollectionDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          collection={selectedCollection}
        />
      )}

      {showUploadModal && (
        <UploadDocumentsModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          collection={selectedCollection}
          onUploadComplete={fetchCollections}
        />
      )}

      {showEditModal && selectedCollection && (
        <EditCollectionModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          collection={selectedCollection}
          onUpdated={handleCollectionUpdated}
        />
      )}
    </div>
  );
};

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default KnowledgePage; 