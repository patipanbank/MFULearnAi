import React, { useState, useEffect, FormEvent } from 'react';
import { config } from '../../config/config';
import { FaPlus, FaTimes, FaCheck, FaEllipsisH, FaTrash, FaLayerGroup} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { jwtDecode } from 'jwt-decode';

// Utility function for relative time
const getRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Recently created';
    }
    
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Created just now';
    if (diffSeconds < 3600) return `Created ${Math.floor(diffSeconds / 60)} minutes ago`;
    if (diffSeconds < 86400) return `Created ${Math.floor(diffSeconds / 3600)} hours ago`;
    
    const days = Math.floor(diffSeconds / 86400);
    if (days === 1) return 'Created yesterday';
    return `Created ${days} days ago`;
  } catch (error) {
    return 'Recently created';
  }
};

/* -------------------------------
   Type Definitions
---------------------------------*/
interface Model {
  id: string;
  name: string;
  collections: string[]; // list of collection names selected in the model
  modelType: 'official' | 'personal';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission: CollectionPermission | string[] | undefined;
}

enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

/* -------------------------------
   Utility Functions
---------------------------------*/
const getModelTypeStyle = (type: string) => {
  switch (type) {
    case 'official':
      return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
    case 'personal':
      return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

/* -------------------------------
   Reusable Base Modal Component
---------------------------------*/
interface BaseModalProps {
  onClose: () => void;
  containerClasses?: string;
  children: React.ReactNode;
  zIndex?: number;
}

const BaseModal: React.FC<BaseModalProps> = ({
  onClose,
  containerClasses = '',
  children,
  zIndex = 50
}) => (
  <div 
    className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    style={{ zIndex }}
    onClick={(e) => {
      if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
      }
    }}
  >
    <div 
      className={`relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg 
        border border-gray-200 dark:border-gray-700 
        transform transition-all duration-200 ${containerClasses}`}
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 
          hover:text-gray-700 dark:hover:text-gray-200 
          p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
          transition-all duration-200"
        title="Close"
      >
        <FaTimes size={20} />
      </button>
      <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
      {children}
      </div>
    </div>
  </div>
);

/* -------------------------------
   Model Card Component
---------------------------------*/
interface ModelCardProps {
  model: Model;
  onCollectionsEdit: (model: Model) => void;
  onDelete: (modelId: string) => void;
  isDeleting: string | null;
}

export const ModelCard: React.FC<ModelCardProps> = ({ model, onCollectionsEdit, onDelete, isDeleting }) => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const { isAdmin } = useAuth();

  const handleCardClick = () => {
    if (model.modelType === 'official' && !isAdmin) {
      window.alert('You do not have permission to access official models');
      return;
    }
    onCollectionsEdit(model);
  };

  return (
    <div
      className="group relative bg-white dark:bg-gray-800 rounded-xl p-6 
        shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer 
        border border-gray-200 dark:border-gray-700 
        hover:border-blue-300 dark:hover:border-blue-600
        transform hover:scale-[1.02]"
      onClick={handleCardClick}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-4 right-4 p-2.5 text-gray-400 hover:text-gray-600 
          dark:text-gray-500 dark:hover:text-gray-300 rounded-lg
          hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
        title="Options"
      >
        <FaEllipsisH size={16} />
      </button>

      {showMenu && (
        <div className="absolute top-14 right-4 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg 
          border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(model.id);
              setShowMenu(false);
            }}
            disabled={isDeleting === model.id}
            className="w-full px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 
              dark:hover:bg-red-900/30 flex items-center space-x-2
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting === model.id ? (
              <>
                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <FaTrash size={14} />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
            {model.name}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Created by: {model.createdBy}
          </p>
        </div>
        
        <div className="mt-auto space-y-4">
          {/* Collections Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <FaLayerGroup className="mr-2" size={14} />
                <span>{model.collections.length} Collections</span>
              </div>
            </div>
            
            {model.collections.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {model.collections.map((collection, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs 
                      font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    {collection}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No collections added
              </p>
            )}
          </div>

          {/* Model Type and Creation Date */}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getModelTypeStyle(model.modelType)}`}>
              {model.modelType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </span>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {getRelativeTime(model.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------
   New Model Modal Component
---------------------------------*/
interface NewModelModalProps {
  newModelName: string;
  newModelType: 'official' | 'personal';
  isCreating: boolean;
  isStaff: boolean;
  onNameChange: (value: string) => void;
  onTypeChange: (value: 'official' | 'personal') => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

const NewModelModal: React.FC<NewModelModalProps> = ({
  newModelName,
  newModelType,
  isCreating,
  isStaff,
  onNameChange,
  onTypeChange,
  onSubmit,
  onCancel,
}) => (
  <BaseModal onClose={onCancel} containerClasses="w-[28rem]">
    <div className="mb-6">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
        Create New Model
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Create a new model to organize your collections and training data.
      </p>
    </div>
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Model Name
        </label>
        <input
          type="text"
          placeholder="Enter model name"
          value={newModelName}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={isCreating}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
            placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Model Type
        </label>
        <select
          value={newModelType}
          onChange={(e) => onTypeChange(e.target.value as 'official' | 'personal')}
          disabled={isCreating}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="personal">Personal</option>
          {isStaff && (
            <>
              <option value="official">Official</option>
            </>
          )}
        </select>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCreating}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
            rounded-xl transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isCreating}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 
            hover:from-blue-700 hover:to-blue-800 text-white rounded-xl 
            transition-all duration-200 transform hover:scale-[1.02]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Creating...
            </div>
          ) : (
            'Create Model'
          )}
        </button>
      </div>
    </form>
  </BaseModal>
);

/* -------------------------------
   Model Collections Modal Component
---------------------------------*/
interface ModelCollectionsModalProps {
  model: Model;
  availableCollections: Collection[];
  selectedCollections: string[];
  searchQuery: string;
  isCollectionsLoading: boolean;
  isSavingCollections: boolean;
  onSearchChange: (value: string) => void;
  onCollectionToggle: (collectionName: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const ModelCollectionsModal: React.FC<ModelCollectionsModalProps> = ({
  model,
  availableCollections,
  selectedCollections,
  searchQuery,
  isCollectionsLoading,
  isSavingCollections,
  onSearchChange,
  onCollectionToggle,
  onConfirm,
  onClose,
}) => {
  const { isStaff } = useAuth();

  const getPermissionStyle = (permission?: CollectionPermission | string[] | undefined) => {
    if (Array.isArray(permission)) {
      return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
    }
    switch (permission) {
      case CollectionPermission.PRIVATE:
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case CollectionPermission.PUBLIC:
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getPermissionLabel = (permission?: CollectionPermission | string[] | undefined) => {
    if (Array.isArray(permission)) {
      return 'Shared';
    }
    switch (permission) {
      case CollectionPermission.PRIVATE:
        return 'Private';
      case CollectionPermission.PUBLIC:
        return 'Public';
      default:
        return 'Unknown';
    }
  };

  // Filter collections based on permissions and model type
  const filteredCollections = availableCollections
    .filter(collection => {
      if (!collection || typeof collection !== 'object') return false;
      
      // Show all collections for staff users
      if (isStaff) return true;

      // For personal models, only show public collections
      if (model.modelType === 'personal') {
        const permission = collection.permission && typeof collection.permission === 'string' 
          ? collection.permission.toLowerCase() 
          : '';
        return permission === 'public';
      }

      // For other model types (which shouldn't be accessible to non-staff anyway)
      return false;
    })
    .filter(collection => {
      if (!collection || !collection.name) return false;
      return collection.name.toLowerCase().includes((searchQuery || '').toLowerCase());
    });

  return (
    <BaseModal onClose={onClose} containerClasses="w-[40rem]">
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Edit Model Collections
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Select collections to associate with this model
        </p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search collections..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isCollectionsLoading}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
            placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {isCollectionsLoading ? (
        <LoadingSpinner message="Loading collections..." />
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-2 mb-6">
          {filteredCollections.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <FaLayerGroup size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No collections found</p>
              <p className="text-sm mt-2">Try adjusting your search query</p>
            </div>
          ) : (
            filteredCollections.map((collection) => (
              <div
                key={collection.id}
                onClick={() => onCollectionToggle(collection.name)}
                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer 
                  transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50
                  ${selectedCollections.includes(collection.name) 
                    ? 'bg-blue-50/50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400' 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  } border`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium 
                      ${getPermissionStyle(collection.permission)}`}
                    >
                      {getPermissionLabel(collection.permission)}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {collection.name}
                  </h4>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Created by {collection.createdBy}
                  </div>
                </div>
                <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all duration-200 
                  flex items-center justify-center ${
                  selectedCollections.includes(collection.name)
                    ? 'border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-400'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selectedCollections.includes(collection.name) && (
                    <FaCheck size={12} className="text-white" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex justify-between items-center border-t dark:border-gray-700 pt-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedCollections.length} collections selected
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSavingCollections}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
              rounded-xl transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSavingCollections}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 
              hover:from-blue-700 hover:to-blue-800 text-white rounded-xl 
              transition-all duration-200 transform hover:scale-[1.02]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingCollections ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </div>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

/* -------------------------------
   Main Model Creation Component
---------------------------------*/
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-8">
    <div className="w-12 h-12 mb-4 relative">
      <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
      <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
    </div>
    <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
  </div>
);

const ModelCreation: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showNewModelModal, setShowNewModelModal] = useState<boolean>(false);
  const [newModelName, setNewModelName] = useState<string>('');
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [isStaff, setIsStaff] = useState<boolean>(false);
  
  // For the model collections modal
  const [availableCollections, setAvailableCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [newModelType, setNewModelType] = useState<'official' | 'personal'>('personal');
  const [isSavingCollections, setIsSavingCollections] = useState(false);

  // Get user role and permissions on component mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const userGroups = tokenPayload.groups || [];
      setIsStaff(userGroups.includes('Admin'));
      setNewModelType((userGroups.includes('Admin')) ? 'official' : 'personal');
    }
  }, []);

  // Load models with permission filtering
  useEffect(() => {
    const fetchModels = async () => {
      setIsModelsLoading(true);
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          console.error('No auth token found');
          return;
        }

        const response = await fetch(`${config.apiUrl}/api/models`, {
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
          }
          throw new Error(`Failed to fetch models: ${errorText}`);
        }

        const modelsFromBackend = await response.json();
        const transformedModels: Model[] = modelsFromBackend.map((model: any) => ({
          id: model._id,
          name: model.name,
          collections: model.collections || [],
          modelType: model.modelType,
          createdAt: model.createdAt,
          updatedAt: model.updatedAt,
          createdBy: model.createdBy
        }));

        setModels(transformedModels);
      } catch (error) {
        console.error('Error fetching models:', error);
        if (error instanceof Error) {
          alert(error.message);
        }
      } finally {
        setIsModelsLoading(false);
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Handle model creation
  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) {
      alert('Please enter a model name');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const tokenPayload = jwtDecode(token);
      const createdBy = (tokenPayload as any).nameID || (tokenPayload as any).username;
      if (!createdBy) {
        throw new Error('No user identifier found in token');
      }

      const response = await fetch(`${config.apiUrl}/api/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newModelName.trim(),
          modelType: newModelType,
          createdBy
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to create model');
      }

      const data = await response.json();
      const newModel: Model = {
        id: data._id,
        name: data.name,
        collections: data.collections || [],
        modelType: data.modelType,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy
      };

      setModels(prevModels => [...prevModels, newModel]);
      setShowNewModelModal(false);
      setNewModelName('');
      setNewModelType(isStaff ? 'official' : 'personal');
    } catch (error) {
      console.error('Error creating model:', error);
      alert(error instanceof Error ? error.message : 'Failed to create model');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle model deletion with proper permissions
  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;

    setIsDeleting(modelId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete model');
      }

      setModels(prevModels => prevModels.filter(m => m.id !== modelId));
    } catch (error) {
      console.error('Error deleting model:', error);
      alert('Failed to delete model. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Open the collections modal for editing a model's collections
  const openEditCollections = async (model: Model) => {
    setEditingModel(model);
    setSelectedCollections(model.collections || []);
    setSearchQuery('');
    setIsCollectionsLoading(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }

      const data = await response.json();
      const transformedCollections = data.map((collection: any) => ({
        id: collection._id?.toString() || collection.id || 'unknown',
        name: collection.name || '',
        createdBy: collection.createdBy || 'Unknown',
        created: collection.created || collection.createdAt || new Date().toISOString(),
        permission: collection.permission || CollectionPermission.PUBLIC
      }));

      setAvailableCollections(transformedCollections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      alert('Failed to fetch collections. Please try again.');
      setEditingModel(null);
    } finally {
      setIsCollectionsLoading(false);
    }
  };

  // Toggle a collection in the selection
  const toggleCollectionSelection = (collectionName: string) => {
    setSelectedCollections((prev) =>
      prev.includes(collectionName)
        ? prev.filter((name) => name !== collectionName)
        : [...prev, collectionName]
    );
  };

  // Confirm the selection and update the model
  const confirmCollections = async () => {
    if (!editingModel) return;
    
    setIsSavingCollections(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/models/${editingModel.id}/collections`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collections: selectedCollections })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update collections');
      }

      const updatedModel = await response.json();
      setModels(prevModels =>
        prevModels.map(m =>
          m.id === editingModel.id ? { ...m, collections: updatedModel.collections } : m
        )
      );
      setEditingModel(null);
    } catch (error) {
      console.error('Error updating collections:', error);
      alert(error instanceof Error ? error.message : 'Failed to update collections');
    } finally {
      setIsSavingCollections(false);
    }
  };

  // Add the useEffect hook to fetch collections when editing a model
  useEffect(() => {
    if (editingModel) {
      // Fetch collections when the editing modal opens
      openEditCollections(editingModel);
    }
  }, [editingModel]);

  return (
    <div className="container mx-auto p-6 font-sans">
      {isLoading ? (
        <LoadingSpinner message="Loading models..." />
      ) : (
        <>
      <header className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
          <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Models</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Create and manage your models for training and chat
            </p>
          </div>
          <button
            onClick={() => setShowNewModelModal(true)}
                className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 
                  hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200
                  transform hover:scale-[1.02] shadow-md hover:shadow-lg"
              >
                <FaPlus className="mr-2" size={16} />
            <span className="font-medium">New Model</span>
          </button>
        </div>
      </header>

          {isModelsLoading ? (
            <LoadingSpinner message="Fetching models..." />
          ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onCollectionsEdit={openEditCollections}
            onDelete={handleDeleteModel}
            isDeleting={isDeleting}
          />
        ))}
      </div>
          )}

          {showNewModelModal && (
            <NewModelModal
              newModelName={newModelName}
              newModelType={newModelType}
              isCreating={isCreating}
              isStaff={isStaff}
              onNameChange={(value) => setNewModelName(value)}
              onTypeChange={(value) => setNewModelType(value)}
              onSubmit={handleCreateModel}
              onCancel={() => setShowNewModelModal(false)}
            />
          )}
          {editingModel && (
            <ModelCollectionsModal
              model={editingModel}
              availableCollections={availableCollections}
              selectedCollections={selectedCollections}
              searchQuery={searchQuery}
              isCollectionsLoading={isCollectionsLoading}
              isSavingCollections={isSavingCollections}
              onSearchChange={setSearchQuery}
              onCollectionToggle={toggleCollectionSelection}
              onConfirm={confirmCollections}
              onClose={() => setEditingModel(null)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ModelCreation;
