import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { config } from '../../config/config';
import { FaPlus, FaTimes, FaCheck, FaEllipsisH } from 'react-icons/fa';

/* -------------------------------
   Type Definitions
---------------------------------*/
interface Model {
  id: string;
  name: string;
  collections: string[]; // list of collection names selected in the model
  modelType: 'official' | 'personal';
}

interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission?: string;
}

/* -------------------------------
   Reusable Base Modal Component
---------------------------------*/
const BaseModal: React.FC<{
  onClose: () => void;
  containerClasses?: string;
  children: React.ReactNode;
}> = ({ onClose, containerClasses = '', children }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div className={`relative bg-white dark:bg-gray-800 rounded p-6 ${containerClasses}`}>
      <button
        onClick={onClose}
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

  return (
    <div
      className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-lg 
      transform hover:scale-105 transition duration-200 cursor-pointer bg-white dark:bg-gray-800"
      onClick={onClick}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-2 right-2 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 
        dark:hover:text-gray-200 transition-colors duration-200"
        title="Options"
      >
        <FaEllipsisH />
      </button>

      {showMenu && (
        <div className="absolute top-8 right-2 bg-white dark:bg-gray-700 border border-gray-200 
        dark:border-gray-600 rounded-lg shadow-lg z-10 overflow-hidden">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename(model.id);
              setShowMenu(false);
            }}
            className="block w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 
            hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Rename
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(model.id);
              setShowMenu(false);
            }}
            className="block w-full px-4 py-2 text-left text-red-600 dark:text-red-400 
            hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Delete
          </button>
        </div>
      )}

      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        Model
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{model.name}</h2>
      {model.collections.length > 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Collections: {model.collections.join(', ')}
        </p>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No collections selected
        </p>
      )}
    </div>
  );
};

/* -------------------------------
   New Model Modal Component
---------------------------------*/
interface NewModelModalProps {
  newModelName: string;
  newModelType: 'official' | 'personal';
  onNameChange: (value: string) => void;
  onTypeChange: (value: 'official' | 'personal') => void;
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
}) => (
  <BaseModal onClose={onCancel} containerClasses="w-96">
    <div className="mb-6">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Create New Model
      </h3>
    </div>
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="New Model Name"
          value={newModelName}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
          focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
          placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Model Type
        </label>
        <select
          value={newModelType}
          onChange={(e) => onTypeChange(e.target.value as 'official' | 'personal')}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
          focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
        >
          <option value="official">Official</option>
          <option value="personal">Personal</option>
        </select>
      </div>
      <div className="flex flex-col space-y-2 pt-4">
        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 
          dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium 
          transform transition-all duration-200"
        >
          Create Model
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
          text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
          transform transition-all duration-200"
        >
          Cancel
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
  const filteredCollections = availableCollections.filter((col) =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  return (
    <BaseModal onClose={onClose} containerClasses="w-full md:w-2/3 lg:w-1/2 max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Select Collections for: {model.name}
        </h3>
        <button 
          onClick={onConfirm} 
          className="p-2 text-green-600 dark:text-green-400 hover:text-green-700 
          dark:hover:text-green-300 transition-colors duration-200"
          title="Confirm"
        >
          <FaCheck size={24} />
        </button>
      </div>
      <input
        type="text"
        placeholder="Search Collections"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-4 py-2 mb-6 rounded-lg border border-gray-300 dark:border-gray-600 
        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
        focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
        placeholder-gray-500 dark:placeholder-gray-400"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredCollections.map((collection) => (
          <div
            key={collection.id}
            onClick={() => toggleCollectionSelection(collection.name)}
            className={`p-4 rounded-lg cursor-pointer border transition-all duration-200
              ${selectedCollections.includes(collection.name)
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
          >
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {collection.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              By {collection.createdBy}
            </p>
          </div>
        ))}
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
  <BaseModal onClose={onCancel} containerClasses="w-96">
    <div className="mb-6">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Rename Model
      </h3>
    </div>
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Model Name"
          value={model.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
          focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
          placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>
      <div className="flex flex-col space-y-2 pt-4">
        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 
          dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium 
          transform transition-all duration-200"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
          text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
          transform transition-all duration-200"
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
  // New state for renaming model
  const [editingModelForRename, setEditingModelForRename] = useState<Model | null>(null);
  
  // For the model collections modal
  const [availableCollections, setAvailableCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState<boolean>(false);
  const [newModelType, setNewModelType] = useState<'official' | 'personal'>('official');

  // Load models from localStorage or create a default model if none exist
  useEffect(() => {
    const fetchOfficialModels = async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        const response = await fetch(`${config.apiUrl}/api/models`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('Failed to fetch models');
        const modelsFromBackend = await response.json();
        setModels(modelsFromBackend.map((model: any) => ({
          id: model._id,
          name: model.name,
          collections: model.collections,
          modelType: model.modelType,
        })));
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };
    fetchOfficialModels();
    
    // Load personal models stored in localStorage.
    const storedPersonalModels: Model[] = JSON.parse(localStorage.getItem('personalModels') || '[]');
    if (storedPersonalModels.length > 0) {
      setModels(prev => [...prev, ...storedPersonalModels]);
    }
  }, []);

  // Update localStorage whenever the models list changes
  useEffect(() => {
    localStorage.setItem('models', JSON.stringify(models));
  }, [models]);

  // Function to fetch available collections (reuse your training/collections endpoint)
  const fetchCollections = useCallback(async () => {
    setIsCollectionsLoading(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();
      setAvailableCollections(data);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setIsCollectionsLoading(false);
    }
  }, []);

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
  const confirmCollections = () => {
    if (editingModel) {
      const updatedModel: Model = { ...editingModel, collections: selectedCollections };
      setModels((prev) =>
        prev.map((m) => (m.id === editingModel.id ? updatedModel : m))
      );
      setEditingModel(null);
    }
  };

  // Create a new model
  const handleCreateModel = async (e: FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) {
      alert('Please enter a model name');
      return;
    }

    if (newModelType === 'official') {
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          alert('Authentication token not found. Please login again.');
          return;
        }

        const response = await fetch(`${config.apiUrl}/api/models`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            name: newModelName.trim(),
            modelType: 'official'
          }),
        });

        if (!response.ok) {
          const errMsg = await response.text();
          throw new Error(errMsg || 'Failed to create model');
        }

        const createdModel = await response.json();
        setModels((prev) => [
          ...prev,
          {
            id: createdModel._id,
            name: createdModel.name,
            collections: createdModel.collections,
            modelType: 'official',
          },
        ]);
      } catch (error) {
        console.error('Error creating official model:', error);
        alert('Error creating official model');
      }
    } else {
      // Create personal model locally.
      const newModel: Model = {
        id: Date.now().toString(),
        name: newModelName.trim(),
        collections: [],
        modelType: 'personal',
      };
      setModels((prev) => [...prev, newModel]);
      // Persist the personal model in localStorage.
      const storedPersonal = JSON.parse(localStorage.getItem('personalModels') || '[]');
      storedPersonal.push(newModel);
      localStorage.setItem('personalModels', JSON.stringify(storedPersonal));
    }
    setNewModelName('');
    setNewModelType('official');
    setShowNewModelModal(false);
  };

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

  // Handler for deleting the model.
  const handleDeleteModel = async (modelId: string) => {
    if (!window.confirm('Are you sure you want to delete this model?')) {
      return;
    }

    const modelToDelete = models.find(m => m.id === modelId);
    if (!modelToDelete) return;

    try {
      if (modelToDelete.modelType === 'official') {
        // Delete official model from MongoDB
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
      } else {
        // For personal models, update localStorage
        const storedPersonal = JSON.parse(localStorage.getItem('personalModels') || '[]');
        const updatedPersonal = storedPersonal.filter((m: Model) => m.id !== modelId);
        localStorage.setItem('personalModels', JSON.stringify(updatedPersonal));
      }

      // Update UI state after successful deletion
      setModels((prevModels) => prevModels.filter((m) => m.id !== modelId));
    } catch (error) {
      console.error('Error deleting model:', error);
      alert('Failed to delete model. Please try again.');
    }
  };

  return (
    <div className="container mx-auto p-6 font-sans">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Models</h1>
        <button
          onClick={() => setShowNewModelModal(true)}
          className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 
          dark:hover:text-blue-300 transition-colors duration-200"
          title="Create Model"
        >
          <FaPlus size={24} />
        </button>
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
            setNewModelType('official');
          }}
        />
      )}
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
    </div>
  );
};

export default ModelCreation;
