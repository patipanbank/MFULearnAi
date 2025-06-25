import React, { useState, useEffect } from 'react';
import { FiUpload, FiTrash2, FiSearch, FiFilter } from 'react-icons/fi';
import { useKnowledgeStore } from '../../shared/stores/knowledgeStore';
import { useUIStore } from '../../shared/stores/uiStore';

const KnowledgeBase: React.FC = () => {
  // Store hooks
  const {
    collections,
    selectedCollection,
    fetchCollections,
    createCollection,
    deleteCollection,
    uploadDocument,
    deleteDocument
  } = useKnowledgeStore();

  const { addToast } = useUIStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);

  // Initialize data
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !selectedCollection) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadDocument(selectedCollection.id, files[i]);
      }
      addToast({
        type: 'success',
        title: 'Upload Success',
        message: 'Documents have been uploaded successfully'
      });
    } catch (error: Error) {
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: error.message || 'Failed to upload documents'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateCollection = async (name: string) => {
    try {
      await createCollection(name);
      addToast({
        type: 'success',
        title: 'Collection Created',
        message: `Collection "${name}" has been created`
      });
    } catch (error: Error) {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: error.message || 'Failed to create collection'
      });
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await deleteCollection(collectionId);
      addToast({
        type: 'success',
        title: 'Collection Deleted',
        message: 'Collection has been deleted'
      });
    } catch (error: Error) {
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete collection'
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedCollection) return;
    
    try {
      await deleteDocument(selectedCollection.id, documentId);
      addToast({
        type: 'success',
        title: 'Document Deleted',
        message: 'Document has been deleted'
      });
    } catch (error: Error) {
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete document'
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Knowledge Base</h1>
          <p className="text-secondary mt-1">
            Manage your document collections and training data
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleCreateCollection('New Collection')}
            className="btn-primary flex items-center space-x-2"
          >
            <FiUpload className="h-5 w-5" />
            <span>Create Collection</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <FiFilter className="h-4 w-4 text-muted" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input min-w-[120px]"
          >
            <option value="all">All Categories</option>
            <option value="documents">Documents</option>
            <option value="websites">Websites</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className="bg-secondary rounded-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-primary">{collection.name}</h3>
              <button
                onClick={() => handleDeleteCollection(collection.id)}
                className="text-red-500 hover:text-red-600"
              >
                <FiTrash2 className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              {collection.documents?.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-tertiary p-2 rounded"
                >
                  <span className="text-sm text-secondary truncate">
                    {doc.name}
                  </span>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id={`file-upload-${collection.id}`}
              />
              <label
                htmlFor={`file-upload-${collection.id}`}
                className="btn-secondary w-full text-center cursor-pointer"
              >
                {isUploading ? 'Uploading...' : 'Upload Documents'}
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBase; 