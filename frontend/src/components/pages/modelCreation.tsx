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
      className="relative border border-gray-200 dark:border-gray-700 rounded p-4 shadow transform hover:scale-105 hover:shadow-lg transition duration-200 cursor-pointer bg-white dark:bg-gray-900"
      onClick={onClick}
    >
      {/* Ellipsis button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
        title="Options"
      >
        <FaEllipsisH />
      </button>

      {showMenu && (
        <div className="absolute top-8 right-2 bg-white dark:bg-gray-800 border border-gray-300 rounded shadow z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename(model.id);
              setShowMenu(false);
            }}
            className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            Rename
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(model.id);
              setShowMenu(false);
            }}
            className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            Delete
          </button>
        </div>
      )}

      <div className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
        Model
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">{model.name}</h2>
      {model.collections.length > 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Collections: {model.collections.join(', ')}
        </p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">No collections selected</p>
      )}
    </div>
  );
};

/* -------------------------------
   New Model Modal Component
---------------------------------*/
interface NewModelModalProps {
  newModelName: string;
  onNameChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}
const NewModelModal: React.FC<NewModelModalProps> = ({
  newModelName,
  onNameChange,
  onSubmit,
  onCancel,
}) => (
  <BaseModal onClose={onCancel} containerClasses="w-80">
    <div className="mb-4">
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
        Create New Model
      </h3>
    </div>
    <form onSubmit={onSubmit}>
      <div className="mb-4">
        <input
          type="text"
          placeholder="New Model Name"
          value={newModelName}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition duration-150"
      >
        Create Model
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 w-full text-red-500 hover:text-red-600 transition duration-150"
      >
        Cancel
      </button>
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
    <BaseModal onClose={onClose} containerClasses="w-full md:w-2/3 lg:w-1/2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Select Collections for: {model.name}
        </h3>
        <button onClick={onConfirm} className="text-green-500 hover:text-green-600" title="Confirm">
          <FaCheck size={20} />
        </button>
      </div>
      <input
        type="text"
        placeholder="Search Collections"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 mb-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredCollections.map((collection) => (
          <div
            key={collection.id}
            className={`border p-4 rounded cursor-pointer ${
              selectedCollections.includes(collection.name)
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'bg-white dark:bg-gray-800'
            }`}
            onClick={() => toggleCollectionSelection(collection.name)}
          >
            <h4 className="font-semibold text-gray-800 dark:text-gray-100">
              {collection.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">By {collection.createdBy}</p>
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
  <BaseModal onClose={onCancel} containerClasses="w-80">
    <div className="mb-4">
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
        Rename Model
      </h3>
    </div>
    <form onSubmit={onSubmit}>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Model Name"
          value={model.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition duration-150"
      >
        Save Changes
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 w-full text-red-500 hover:text-red-600 transition duration-150"
      >
        Cancel
      </button>
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

  // Load models from localStorage or create a default model if none exist
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        const response = await fetch(`${config.apiUrl}/api/models`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch models');
        const modelsFromBackend = await response.json();
        // Convert the fetched models as needed before saving to state
        setModels(modelsFromBackend.map((model: any) => ({
          id: model._id,
          name: model.name,
          collections: model.collections,
        })));
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };

    fetchModels();
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
  const handleCreateModel = (e: FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) {
      alert('Please enter a model name');
      return;
    }
    const newModel: Model = {
      id: Date.now().toString(),
      name: newModelName.trim(),
      collections: [],
    };
    setModels((prev) => [...prev, newModel]);
    setNewModelName('');
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
  const handleDeleteModel = (modelId: string) => {
    if (window.confirm('Are you sure you want to delete this model?')) {
      setModels((prevModels) => prevModels.filter((m) => m.id !== modelId));
    }
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Models</h1>
        <button
          onClick={() => setShowNewModelModal(true)}
          className="text-xl p-2 text-blue-500 hover:text-blue-600 transition duration-150"
          title="Create Model"
        >
          <FaPlus />
        </button>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
          onNameChange={setNewModelName}
          onSubmit={handleCreateModel}
          onCancel={() => {
            setShowNewModelModal(false);
            setNewModelName('');
          }}
        />
      )}
      {editingModel && isCollectionsLoading ? (
        <div className="text-center py-4">Loading collections...</div>
      ) : editingModel && (
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
