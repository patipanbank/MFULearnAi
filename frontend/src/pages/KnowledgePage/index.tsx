import React, { useEffect, useState } from 'react';
import { FiDatabase, FiRefreshCcw, FiPlus, FiSearch, FiFolder, FiFile, FiUpload, FiEye } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';
import CreateCollectionModal from './CreateCollectionModal';
import CollectionDetailModal from './CollectionDetailModal';
import UploadDocumentsModal from './UploadDocumentsModal';

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
  const [analytics, setAnalytics] = useState({
    totalCollections: 0,
    totalDocuments: 0,
    totalSize: 0
  });
  const { addToast } = useUIStore();

  const fetchCollections = async () => {
    setLoading(true);
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
    } catch (error) {
      console.error('Error fetching collections:', error);
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
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FiFolder className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-muted">Total Collections</p>
              <p className="text-2xl font-bold text-primary">{analytics.totalCollections}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <FiFile className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-muted">Total Documents</p>
              <p className="text-2xl font-bold text-primary">{analytics.totalDocuments}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <FiDatabase className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-muted">Total Size</p>
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
            className="btn-ghost flex items-center space-x-2"
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

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCollections.map((collection) => (
          <div key={collection.id} className="card card-hover p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary mb-1">{collection.name}</h3>
                <p className="text-sm text-muted mb-2">Created by {collection.createdBy}</p>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    collection.permission === 'PUBLIC' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {collection.permission}
                  </span>
                                     <span className="text-xs text-muted">
                     {collection.createdAt ? new Date(collection.createdAt).toLocaleDateString() : 'Unknown'}
                   </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedCollection(collection);
                    setShowDetailModal(true);
                  }}
                  className="btn-ghost p-2"
                  title="View Details"
                >
                  <FiEye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedCollection(collection);
                    setShowUploadModal(true);
                  }}
                  className="btn-ghost p-2"
                  title="Upload Documents"
                >
                  <FiUpload className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted">
                {/* Document count will be added here */}
                <span>0 documents</span>
              </div>
              <button
                onClick={() => {
                  setSelectedCollection(collection);
                  setShowDetailModal(true);
                }}
                className="btn-secondary text-sm"
              >
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCollections.length === 0 && !loading && (
        <div className="text-center py-12">
          <FiFolder className="h-16 w-16 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No collections found</h3>
          <p className="text-muted mb-6">
            {searchQuery ? 'Try adjusting your search terms.' : 'Get started by creating your first collection.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Create Collection
            </button>
          )}
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