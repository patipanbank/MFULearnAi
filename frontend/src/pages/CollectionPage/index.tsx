import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiDatabase, FiEdit, FiTrash2, FiDownload, FiUpload } from 'react-icons/fi';
import { useModelsStore } from '../../shared/stores/modelsStore';
import { useUIStore } from '../../shared/stores/uiStore';

const CollectionPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  
  const { 
    collections, 
    selectedCollections: storeSelectedCollections,
    toggleCollection,
    fetchCollections,
    collectionsLoading 
  } = useModelsStore();

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateCollection = () => {
    setEditingCollection(null);
    setIsCreateModalOpen(true);
  };

  const handleEditCollection = (collection: any) => {
    setEditingCollection(collection);
    setIsCreateModalOpen(true);
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      try {
        // Add delete logic here
        console.log('Deleting collection:', collectionId);
      } catch (error) {
        console.error('Failed to delete collection:', error);
      }
    }
  };

  const handleBulkSelect = (collectionId: string) => {
    setSelectedCollections(prev => 
      prev.includes(collectionId) 
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCollections.length === filteredCollections.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(filteredCollections.map(c => c.id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Knowledge Base Collections</h1>
          <p className="text-secondary mt-1">Manage your document collections and knowledge bases</p>
        </div>
        
        <button
          onClick={handleCreateCollection}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlus className="h-5 w-5" />
          <span>Create Collection</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
            <input
              type="text"
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <select className="select">
            <option value="">All Permissions</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="shared">Shared</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSelectAll}
            className="btn-ghost"
          >
            {selectedCollections.length === filteredCollections.length ? 'Deselect All' : 'Select All'}
          </button>
          
          {selectedCollections.length > 0 && (
            <button className="px-3 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
              Delete Selected ({selectedCollections.length})
            </button>
          )}
        </div>
      </div>

      {/* Collections Grid */}
      {collectionsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-secondary">Loading collections...</span>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-12">
          <FiDatabase className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="text-lg font-medium text-primary mb-2">
            {searchTerm ? 'No collections found' : 'No collections yet'}
          </h3>
          <p className="text-secondary mb-6">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Create your first knowledge base collection to get started'
            }
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreateCollection}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <FiPlus className="h-4 w-4" />
              <span>Create Collection</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((collection) => (
            <div
              key={collection.id}
              className={`card card-hover p-6 ${
                storeSelectedCollections.includes(collection.id) ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(collection.id)}
                    onChange={() => handleBulkSelect(collection.id)}
                    className="rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <FiDatabase className="h-6 w-6 text-blue-600 flex-shrink-0" />
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEditCollection(collection)}
                    className="btn-ghost p-1 hover:!text-blue-600 hover:!bg-blue-50 dark:hover:!bg-blue-900/20"
                  >
                    <FiEdit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCollection(collection.id)}
                    className="btn-ghost p-1 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-primary mb-2">{collection.name}</h3>
                <p className="text-sm text-secondary line-clamp-2">
                  Collection for {collection.permission} access
                </p>
              </div>

              <div className="flex items-center justify-between text-sm text-muted mb-4">
                <span>Created by: {collection.createdBy}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  collection.permission === 'public' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  collection.permission === 'private' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {collection.permission}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleCollection(collection.id)}
                  className={`px-3 py-1 rounded-xl text-sm font-medium transition-colors ${
                    storeSelectedCollections.includes(collection.id)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'btn-secondary'
                  }`}
                >
                  {storeSelectedCollections.includes(collection.id) ? 'Selected' : 'Select'}
                </button>
                
                <div className="flex items-center space-x-2">
                  <button className="btn-ghost p-1 hover:!text-blue-600 hover:!bg-blue-50 dark:hover:!bg-blue-900/20">
                    <FiDownload className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost p-1 hover:!text-blue-600 hover:!bg-blue-50 dark:hover:!bg-blue-900/20">
                    <FiUpload className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isCreateModalOpen && (
        <CreateCollectionModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          collection={editingCollection}
          onSave={() => {
            setIsCreateModalOpen(false);
            fetchCollections();
          }}
        />
      )}
    </div>
  );
};

// Create Collection Modal Component
interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection?: any;
  onSave: () => void;
}

const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({ 
  isOpen, 
  onClose, 
  collection, 
  onSave 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission: 'private' as 'public' | 'private' | 'shared'
  });

  const { addToast } = useUIStore();

  useEffect(() => {
    if (collection) {
      setFormData({
        name: collection.name || '',
        description: collection.description || '',
        permission: collection.permission || 'private'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        permission: 'private'
      });
    }
  }, [collection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Add create/update logic here
      console.log('Saving collection:', formData);
      
      addToast({
        type: 'success',
        title: collection ? 'Collection Updated' : 'Collection Created',
        message: `Collection "${formData.name}" has been ${collection ? 'updated' : 'created'} successfully`
      });
      
      onSave();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save collection'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md w-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-primary">
            {collection ? 'Edit Collection' : 'Create New Collection'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Collection Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Enter collection name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
              placeholder="Enter collection description"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Permission
            </label>
            <select
              value={formData.permission}
              onChange={(e) => setFormData({ ...formData, permission: e.target.value as any })}
              className="select"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="shared">Shared</option>
            </select>
          </div>
          
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {collection ? 'Update' : 'Create'} Collection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollectionPage; 