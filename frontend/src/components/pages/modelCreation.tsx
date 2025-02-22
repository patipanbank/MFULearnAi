import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { config } from '../../config/config';
import { FaPlus, FaTimes, FaCheck, FaEllipsisH, FaEdit, FaTrash, FaLayerGroup, FaUser } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

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
  modelType: 'official' | 'personal' | 'staff_only';
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
  STAFF_ONLY = 'STAFF_ONLY',
  PRIVATE = 'PRIVATE'
}

/* -------------------------------
   Utility Functions
---------------------------------*/

/* -------------------------------
   Reusable Base Modal Component
---------------------------------*/
const BaseModal: React.FC<{
  onClose: () => void;
  containerClasses?: string;
  children: React.ReactNode;
  zIndex?: number;
}> = ({ onClose, containerClasses = '', children, zIndex = 50 }) => (
  <div 
    className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-50`}
    style={{ zIndex }}
    onClick={(e) => {
      // Only close if clicking the backdrop (not the modal content)
      if (e.target === e.currentTarget) {
        e.stopPropagation(); // Prevent event from reaching other modals
        onClose();
      }
    }}>
    <div className={`relative bg-white dark:bg-gray-800 rounded p-6 ${containerClasses}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
        title="Close"
      >
        <FaTimes size={20} />
      </button>
      {children}
    </div>
  </div>
);

/* -------------------------------
   Model Card Component
---------------------------------*/
interface ModelCardProps {
  model: Model;
  onClick: () => void;
  onRename: (modelId: string) => void;
  onDelete: (modelId: string) => void;
}
const ModelCard: React.FC<ModelCardProps> = ({ model, onClick, onRename, onDelete }) => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const { isStaff } = useAuth();

  const handleCardClick = () => {
    if (model.modelType === 'official' && !isStaff) {
      window.alert('You do not have permission to access official models');
      return;
    }
    onClick();
  };

  const getModelTypeStyle = (type: string) => {
    switch (type) {
      case 'official':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'staff_only':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      case 'personal':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md 
      hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 
      border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600
      ${model.modelType === 'official' && !isStaff ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
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
              onRename(model.id);
              setShowMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 
            dark:hover:bg-gray-700 flex items-center space-x-2"
          >
            <FaEdit size={14} />
            <span>Rename</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(model.id);
              setShowMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 
            dark:hover:bg-red-900/30 flex items-center space-x-2"
          >
            <FaTrash size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
            {model.name}
          </h2>
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <FaLayerGroup className="mr-2" size={14} />
            <span>{model.collections.length} Collections</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {model.collections.map((collection, index) => (
              <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs 
              font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                {collection}
              </span>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getModelTypeStyle(model.modelType)}`}>
              {model.modelType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </span>
            {model.createdAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getRelativeTime(model.createdAt)}
              </div>
            )}
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
  newModelType: 'official' | 'personal' | 'staff_only';
  onNameChange: (value: string) => void;
  onTypeChange: (value: 'official' | 'personal' | 'staff_only') => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}
const NewModelModal: React.FC<NewModelModalProps> = ({
  newModelName,
  newModelType,
  onNameChange,
  onTypeChange,
  onSubmit,
  onCancel,
}) => {
  const { isStaff } = useAuth();

  return (
    <BaseModal onClose={onCancel} containerClasses="w-[28rem]" zIndex={52}>
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
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
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
            focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
            placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
          />
        </div>
        {isStaff && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model Type
            </label>
            <select
              value={newModelType}
              onChange={(e) => onTypeChange(e.target.value as 'official' | 'personal' | 'staff_only')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
              transition-all duration-200"
            >
              <option value="official">Official</option>
              <option value="staff_only">Staff Only</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        )}
        <div className="flex flex-col space-y-2 pt-4">
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-lg font-medium text-white
            bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
            dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 
            transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Create Model
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
            text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
            transform hover:scale-[1.02] transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

/* -------------------------------
   Model Collections Modal Component
---------------------------------*/
interface ModelCollectionsModalProps {
  model: Model;
  availableCollections: Collection[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCollections: string[];
  toggleCollectionSelection: (collectionName: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}
const ModelCollectionsModal: React.FC<ModelCollectionsModalProps> = ({
  model,
  availableCollections,
  searchQuery,
  onSearchChange,
  selectedCollections,
  toggleCollectionSelection,
  onConfirm,
  onClose,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const { isStaff } = useAuth();

  const getPermissionStyle = (permission?: string | string[]) => {
    if (Array.isArray(permission)) {
      return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
    }
    const normalized = permission ? permission.toLowerCase() : '';
    switch (normalized) {
      case 'private':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'public':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'staff_only':
      case 'staffonly':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getPermissionLabel = (permission?: string | string[]) => {
    if (Array.isArray(permission)) {
      return 'Shared';
    }
    const normalized = permission ? permission.toLowerCase() : '';
    switch (normalized) {
      case 'private':
        return 'Private';
      case 'public':
        return 'Public';
      case 'staff_only':
      case 'staffonly':
        return 'Staff Only';
      default:
        return 'Unknown';
    }
  };

  // Filter collections based on permissions and model type
  const filteredCollections = availableCollections.filter(collection => {
    // Show all collections for staff users
    if (isStaff) return true;

    // For personal models, only show public collections
    if (model.modelType === 'personal') {
      const permission = typeof collection.permission === 'string' ? collection.permission.toLowerCase() : '';
      return permission === 'public';
    }

    // For other model types (which shouldn't be accessible to non-staff anyway)
    return false;
  }).filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle confirm with loading state
  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Error confirming collections:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <BaseModal onClose={onClose} containerClasses="w-full md:w-2/3 lg:w-1/2 max-h-[80vh] overflow-y-auto" zIndex={50}>
      <div className="relative">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-gray-700">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-semibold bg-gradient-to-r from-gray-900 to-gray-700 
              dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                Collections for {model.name}
              </h3>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Select collections to include in this model (optional)
            </p>
          </div>
        </div>

        {/* Search Section */}
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-3 pl-12 rounded-xl border border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
            placeholder-gray-500 dark:placeholder-gray-400
            focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
            transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
        </div>

        {/* Collections Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 min-h-[300px]">
          {filteredCollections.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 py-8">
              <FaLayerGroup size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">No collections found</p>
              <p className="text-sm mt-2">Try adjusting your search query</p>
            </div>
          ) : (
            filteredCollections.map((collection) => (
              <div
                key={collection.id}
                onClick={() => toggleCollectionSelection(collection.name)}
                className={`group p-4 rounded-xl cursor-pointer border transition-all duration-300
                  transform hover:scale-[1.02] ${
                  selectedCollections.includes(collection.name)
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPermissionStyle(collection.permission)}`}>
                          {getPermissionLabel(collection.permission)}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                        {collection.name}
                      </h4>
                    </div>
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
                      selectedCollections.includes(collection.name)
                        ? 'border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-400'
                        : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-300 dark:group-hover:border-blue-600'
                    }`}>
                      {selectedCollections.includes(collection.name) && (
                        <FaCheck size={12} className="text-white" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2 mt-auto">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <FaUser className="mr-2" size={12} />
                      <span className="truncate">{collection.createdBy}</span>
                    </div>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      {getRelativeTime(collection.created)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="sticky bottom-0 left-0 right-0 mt-6 pt-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 
        flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCollections.length} collections selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
              transition-all duration-200"
              disabled={isConfirming}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 
              text-white font-medium transition-all duration-200 transform 
              ${isConfirming ? 'opacity-75 cursor-not-allowed' : 'hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] shadow-md hover:shadow-lg'}`}
            >
              {isConfirming ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Confirming...
                </span>
              ) : (
                'Save Collections'
              )}
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

/* -------------------------------
   Edit Model Modal Component
---------------------------------*/
interface EditModelModalProps {
  model: Model;
  onNameChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

const EditModelModal: React.FC<EditModelModalProps> = ({
  model,
  onNameChange,
  onSubmit,
  onCancel,
}) => (
  <BaseModal onClose={onCancel} containerClasses="w-[28rem]" zIndex={51}>
    <div className="mb-6">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Rename Model
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Update the name of your model
      </p>
    </div>
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Model Name
        </label>
        <input
          type="text"
          placeholder="Enter new name"
          value={model.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
          focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
          placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
        />
      </div>
      <div className="flex flex-col space-y-2 pt-4">
        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-lg font-medium text-white
          bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
          dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 
          transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
          text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
          transform hover:scale-[1.02] transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </form>
  </BaseModal>
);

/* -------------------------------
   Main Model Creation Component
---------------------------------*/
const ModelCreation: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [showNewModelModal, setShowNewModelModal] = useState<boolean>(false);
  const [newModelName, setNewModelName] = useState<string>('');
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editingModelForRename, setEditingModelForRename] = useState<Model | null>(null);
  const [isStaff, setIsStaff] = useState<boolean>(false);
  
  // For the model collections modal
  const [availableCollections, setAvailableCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState<boolean>(false);
  const [newModelType, setNewModelType] = useState<'official' | 'personal' | 'staff_only'>('personal');

  // Get user role and permissions on component mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const userGroups = tokenPayload.groups || [];
      setIsStaff(userGroups.includes('Staffs'));
      setNewModelType(userGroups.includes('Staffs') ? 'official' : 'personal');
    }
  }, []);

  // Load models with permission filtering
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          console.error('No auth token found');
          return;
        }

        // Validate token format
        const tokenParts = authToken.split('.');
        if (tokenParts.length !== 3) {
          console.error('Invalid token format');
          return;
        }
        
        console.log('Fetching models with token:', `Bearer ${authToken}`);
        const response = await fetch(`${config.apiUrl}/api/models`, {
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch models:', response.status, errorText);
          
          if (response.status === 401) {
            // Token might be expired or invalid
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
          }
          
          throw new Error(`Failed to fetch models: ${errorText}`);
        }

        const modelsFromBackend = await response.json();
        
        // Transform backend models to match frontend interface
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
      }
    };
    fetchModels();
  }, []);

  // Handle model creation
  const handleCreateModel = async (e: FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) {
      alert('Please enter a model name');
      return;
    }

    // Get username from auth token
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      alert('Authentication token not found. Please login again.');
      return;
    }

    try {
      const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
      
      // Log the full token payload for debugging
      console.log('Full token payload:', {
        ...tokenPayload,
        // Redact any sensitive information
        exp: '[redacted]',
        iat: '[redacted]'
      });

      // Try to get user identifier in order of preference
      let createdBy = null;
      if (tokenPayload.nameID) {
        createdBy = tokenPayload.nameID;
        console.log('Using nameID as createdBy:', createdBy);
      } else if (tokenPayload.username) {
        createdBy = tokenPayload.username;
        console.log('Using username as createdBy:', createdBy);
      } else if (tokenPayload.userId) {
        createdBy = tokenPayload.userId;
        console.log('Using userId as createdBy:', createdBy);
      }

      if (!createdBy) {
        console.error('No valid user identifier found in token:', tokenPayload);
        throw new Error('Could not determine user identity. Please try logging in again.');
      }

      console.log('Creating model with:', {
        userGroups: tokenPayload.groups,
        isStaff: tokenPayload.groups?.includes('Staffs'),
        modelType: newModelType,
        createdBy,
        requestBody: {
          name: newModelName.trim(),
          modelType: newModelType,
          createdBy,
          userId: createdBy
        }
      });

      // Create model in database
      const response = await fetch(`${config.apiUrl}/api/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newModelName.trim(),
          modelType: newModelType,
          createdBy,
          userId: createdBy
        }),
      });

      if (!response.ok) {
        const errMsg = await response.text();
        console.error('Server error response:', errMsg);
        throw new Error(errMsg || 'Failed to create model');
      }

      const createdModel = await response.json();
      console.log('Created model response:', createdModel);
      
      // Transform the response to match our frontend Model interface
      const newModel: Model = {
        id: createdModel._id,
        name: createdModel.name,
        collections: createdModel.collections || [],
        modelType: createdModel.modelType,
        createdAt: createdModel.createdAt,
        updatedAt: createdModel.updatedAt,
        createdBy: createdModel.createdBy
      };

      setModels(prev => [...prev, newModel]);
      setNewModelName('');
      setShowNewModelModal(false);
    } catch (error) {
      console.error('Error creating model:', error);
      alert(error instanceof Error ? error.message : 'Failed to create model. Please try again.');
    }
  };

  // Handle model deletion with proper permissions
  const handleDeleteModel = async (modelId: string) => {
    if (!window.confirm('Are you sure you want to delete this model?')) {
      return;
    }

    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        alert('Authentication token not found. Please login again.');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errMsg = await response.text();
        throw new Error(errMsg || 'Failed to delete model');
      }

      // Update UI state
      setModels((prevModels) => prevModels.filter((m) => m.id !== modelId));
    } catch (error) {
      console.error('Error deleting model:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete model. Please try again.');
    }
  };

  // Open the collections modal for editing a model's collections
  const openEditCollections = (model: Model) => {
    setEditingModel(model);
    setSelectedCollections(model.collections);
    setSearchQuery('');
    fetchCollections();
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
    
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        alert('Authentication token not found. Please login again.');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/models/${editingModel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          collections: selectedCollections,
          modelType: editingModel.modelType
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || 'Failed to update model collections');
      }

      // Get updated model from response
      const updatedModel = await response.json();

      // Update state with response data
      setModels(prev =>
        prev.map(m =>
          m.id === editingModel.id ? {
            ...m,
            collections: updatedModel.collections || selectedCollections,
            updatedAt: updatedModel.updatedAt
          } : m
        )
      );

      // Clear editing state
      setEditingModel(null);
      setSelectedCollections([]);
    } catch (error) {
      console.error('Error updating collections:', error);
      alert(error instanceof Error ? error.message : 'Failed to update collections. Please try again.');
    }
  };

  // Function to fetch available collections (reuse your training/collections endpoint)
  const fetchCollections = useCallback(async () => {
    setIsCollectionsLoading(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) throw new Error('No auth token found');

      const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
      const isStaffUser = tokenPayload.groups.includes('Staffs') || tokenPayload.groups.includes('Admin');

      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();

      // Filter collections based on user role and permissions
      const filteredCollections = data.filter((collection: Collection) => {
        if (isStaffUser) return true;
        const permission = typeof collection.permission === 'string' ? collection.permission.toLowerCase() : '';
        return permission === 'public';
      });

      setAvailableCollections(filteredCollections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      alert('Failed to fetch collections. Please try again.');
    } finally {
      setIsCollectionsLoading(false);
    }
  }, []);

  // Handler for when a model's ellipsis menu "Rename" is clicked.
  const handleRenameModel = (modelId: string) => {
    const modelToEdit = models.find((m) => m.id === modelId);
    if (modelToEdit) {
      setEditingModelForRename(modelToEdit);
    }
  };

  // Handler for updating the model's name.
  const handleUpdateModelName = (e: FormEvent) => {
    e.preventDefault();
    if (editingModelForRename) {
      setModels((prevModels) =>
        prevModels.map((m) =>
          m.id === editingModelForRename.id ? editingModelForRename : m
        )
      );
      setEditingModelForRename(null);
    }
  };

  return (
    <div className="container mx-auto p-6 font-sans">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Models</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Create and manage your models for training and chat
            </p>
          </div>
          <button
            onClick={() => setShowNewModelModal(true)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 
            hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 
            dark:hover:from-blue-600 dark:hover:to-blue-700 text-white rounded-lg 
            transition-all duration-200 space-x-2 shadow-md hover:shadow-lg 
            transform hover:scale-105"
          >
            <FaPlus size={16} />
            <span className="font-medium">New Model</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onClick={() => openEditCollections(model)}
            onRename={handleRenameModel}
            onDelete={handleDeleteModel}
          />
        ))}
      </div>

      {/* Modals */}
      {editingModel && !isCollectionsLoading && (
        <ModelCollectionsModal
          model={editingModel}
          availableCollections={availableCollections}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCollections={selectedCollections}
          toggleCollectionSelection={toggleCollectionSelection}
          onConfirm={confirmCollections}
          onClose={() => setEditingModel(null)}
        />
      )}

      {editingModelForRename && (
        <EditModelModal
          model={editingModelForRename}
          onNameChange={(value) =>
            setEditingModelForRename({ ...editingModelForRename, name: value })
          }
          onSubmit={handleUpdateModelName}
          onCancel={() => setEditingModelForRename(null)}
        />
      )}

      {showNewModelModal && (
        <NewModelModal
          newModelName={newModelName}
          newModelType={newModelType}
          onNameChange={setNewModelName}
          onTypeChange={setNewModelType}
          onSubmit={handleCreateModel}
          onCancel={() => {
            setShowNewModelModal(false);
            setNewModelName('');
            setNewModelType(isStaff ? 'official' : 'personal');
          }}
        />
      )}
    </div>
  );
};

export default ModelCreation;
