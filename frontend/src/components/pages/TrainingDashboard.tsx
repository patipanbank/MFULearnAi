import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { config } from '../../config/config';
import { FaPlus, FaTimes, FaCog, FaEllipsisH } from 'react-icons/fa';
import DarkModeToggle from '../darkmode/DarkModeToggle';

// ----------------------
// Type Definitions
// ----------------------
interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission?: string;
}

interface UploadedFile {
  filename: string;
  uploadedBy: string;
  timestamp: string;
  ids: string[];
}

// ----------------------
// Utility Functions
// ----------------------
const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffSeconds = (now.getTime() - date.getTime()) / 1000;
  if (diffSeconds < 60) return 'Updated just now';
  const diffMinutes = diffSeconds / 60;
  if (diffMinutes < 60) return `Updated ${Math.floor(diffMinutes)} minutes ago`;
  const diffHours = diffMinutes / 60;
  if (diffHours < 24) return `Updated ${Math.floor(diffHours)} hours ago`;
  const diffDays = diffHours / 24;
  return `Updated ${Math.floor(diffDays)} days ago`;
};

// ----------------------
// Reusable Modal Component
// ----------------------
interface BaseModalProps {
  onClose: () => void;
  containerClasses?: string;
  children: React.ReactNode;
}

const BaseModal: React.FC<BaseModalProps> = ({
  onClose,
  containerClasses = '',
  children,
}) => (
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

// ----------------------
// Dashboard Header Component
// ----------------------
interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewCollectionToggle: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewCollectionToggle,
}) => (
  <header className="mb-6">
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Knowledge 11</h1>
      <DarkModeToggle />
    </div>
    <div className="mt-4 flex items-center">
      <input
        type="text"
        placeholder="Search Knowledge"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={onNewCollectionToggle}
        className="ml-2 text-xl p-2 bg-blue-500 rounded-full text-white hover:bg-blue-600 transition duration-150"
        title="Create Collection"
      >
        <FaPlus />
      </button>
    </div>
  </header>
);

// ----------------------
// New Collection Modal Component
// ----------------------
interface NewCollectionModalProps {
  newCollectionName: string;
  newCollectionPermission: string;
  onNameChange: (value: string) => void;
  onPermissionChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

const NewCollectionModal: React.FC<NewCollectionModalProps> = ({
  newCollectionName,
  newCollectionPermission,
  onNameChange,
  onPermissionChange,
  onSubmit,
  onCancel,
}) => (
  <BaseModal onClose={onCancel} containerClasses="w-80">
    <div className="mb-4">
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
        Create New Collection
      </h3>
    </div>
    <form onSubmit={onSubmit}>
      <div className="mb-4">
        <input
          type="text"
          placeholder="New Collection Name"
          value={newCollectionName}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <select
          value={newCollectionPermission}
          onChange={(e) => onPermissionChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="PRIVATE">Private</option>
          <option value="STAFF_ONLY">Staff Only</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>
      <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition duration-150">
        Create Collection
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

// ----------------------
// Collection Card Component
// ----------------------
interface CollectionCardProps {
  collection: Collection;
  onSelect: () => void;
  activeDropdown: boolean;
  onDropdownToggle: () => void;
  onSettings: () => void;
  onDelete: () => void;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  onSelect,
  activeDropdown,
  onDropdownToggle,
  onSettings,
  onDelete,
}) => (
  <div
    className="relative border border-gray-200 dark:border-gray-700 rounded p-4 shadow transform hover:scale-105 hover:shadow-lg transition duration-200 cursor-pointer bg-white dark:bg-gray-900"
    onClick={onSelect}
  >
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDropdownToggle();
      }}
      className="absolute top-2 right-2 p-1 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition duration-150"
      title="Options"
    >
      <FaEllipsisH />
    </button>
    {activeDropdown && (
      <div className="absolute top-10 right-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSettings();
          }}
          className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left text-gray-800 dark:text-gray-100"
        >
          Settings
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left text-gray-800 dark:text-gray-100"
        >
          Delete
        </button>
      </div>
    )}
    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Collection</div>
    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">{collection.name}</h2>
    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">By {collection.createdBy}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400">{getRelativeTime(collection.created)}</p>
  </div>
);

// ----------------------
// Collection Modal (File Management)
// ----------------------
interface CollectionModalProps {
  collection: Collection;
  onClose: () => void;
  uploadedFiles: UploadedFile[];
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFileUpload: (e: FormEvent) => void;
  uploadLoading: boolean;
  onShowSettings: () => void;
}

const CollectionModal: React.FC<CollectionModalProps> = ({
  collection,
  onClose,
  uploadedFiles,
  onFileChange,
  onFileUpload,
  uploadLoading,
  onShowSettings,
}) => (
  <BaseModal onClose={onClose} containerClasses="w-full md:w-2/3 lg:w-1/2 relative overflow-y-auto max-h-full">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{collection.name}</h2>
      <button
        onClick={onShowSettings}
        className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-150"
        title="Collection Settings"
      >
        <FaCog size={20} className="text-gray-800 dark:text-gray-100" />
      </button>
    </div>
    <section className="mb-6">
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Upload File</h3>
      <form onSubmit={onFileUpload} className="flex flex-col sm:flex-row items-start sm:items-center">
        <input
          type="file"
          onChange={onFileChange}
          className="mb-2 sm:mb-0 sm:mr-2 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={uploadLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition duration-150"
        >
          {uploadLoading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </section>
    <section>
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Files in the Collection</h3>
      {uploadedFiles.length > 0 ? (
        <ul className="space-y-2">
          {uploadedFiles.map((fileItem, index) => (
            <li key={index} className="border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800">
              <div className="font-semibold text-gray-800 dark:text-gray-100">{fileItem.filename}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Uploaded by: {fileItem.uploadedBy}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                At: {new Date(fileItem.timestamp).toLocaleString()}
              </div>
              <div className="text-sm text-gray-400 dark:text-gray-300">Chunks: {fileItem.ids.length}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-600 dark:text-gray-300">No files uploaded yet.</p>
      )}
    </section>
  </BaseModal>
);

// ----------------------
// Settings Modal Component
// ----------------------
interface SettingsModalProps {
  updatedCollectionName: string;
  updatedCollectionPermission: string;
  onNameChange: (value: string) => void;
  onPermissionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  updatedCollectionName,
  updatedCollectionPermission,
  onNameChange,
  onPermissionChange,
  onClose,
  onSubmit,
}) => (
  <BaseModal onClose={onClose} containerClasses="w-80">
    <div className="mb-4">
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Collection Settings</h3>
    </div>
    <form onSubmit={onSubmit}>
      <div className="mb-4">
        <label className="block mb-1 text-gray-800 dark:text-gray-100">Collection Name</label>
        <input
          type="text"
          value={updatedCollectionName}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-800 dark:text-gray-100">Permission</label>
        <select
          value={updatedCollectionPermission}
          onChange={(e) => onPermissionChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="PRIVATE">Private</option>
          <option value="STAFF_ONLY">Staff Only</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>
      <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded w-full transition duration-150">
        Save Changes
      </button>
    </form>
  </BaseModal>
);

// ----------------------
// Main Dashboard Component
// ----------------------
const TrainingDashboard: React.FC = () => {
  // Dashboard state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [showNewCollectionModal, setShowNewCollectionModal] = useState<boolean>(false);
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [newCollectionPermission, setNewCollectionPermission] = useState<string>('PRIVATE');

  // Selected collection and dropdown state
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // File upload and management state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);

  // Settings modal state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [updatedCollectionName, setUpdatedCollectionName] = useState<string>('');
  const [updatedCollectionPermission, setUpdatedCollectionPermission] = useState<string>('PRIVATE');

  // Loading state for collections
  const [isCollectionsLoading, setIsCollectionsLoading] = useState<boolean>(false);

  const authToken = localStorage.getItem('auth_token');

  // ----------------------
  // API Calls
  // ----------------------
  const fetchCollections = useCallback(async () => {
    setIsCollectionsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();
      const collectionsWithDate: Collection[] = data.map((collection: any) => ({
        ...collection,
        created: collection.created || new Date().toISOString(),
      }));
      setCollections(collectionsWithDate);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setIsCollectionsLoading(false);
    }
  }, [authToken]);

  const fetchUploadedFiles = useCallback(async (collectionName: string) => {
    try {
      const response = await fetch(
        `${config.apiUrl}/api/training/documents?collectionName=${encodeURIComponent(collectionName)}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      console.log('Fetched files:', data);
      if (data.files) {
        setUploadedFiles(data.files);
      } else {
        setUploadedFiles(data);
      }
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
    }
  }, [authToken]);

  // ----------------------
  // Effects
  // ----------------------
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    if (selectedCollection) {
      setUpdatedCollectionName(selectedCollection.name);
      setUpdatedCollectionPermission(selectedCollection.permission || 'PRIVATE');
      fetchUploadedFiles(selectedCollection.name);
    }
  }, [selectedCollection, fetchUploadedFiles]);

  // ----------------------
  // Event Handlers
  // ----------------------
  const handleCreateCollection = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) {
      alert('Please enter a collection name');
      return;
    }
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newCollectionName,
          permission: newCollectionPermission,
        }),
      });
      if (!response.ok) throw new Error('Failed to create collection');
      await fetchCollections();
      setNewCollectionName('');
      setShowNewCollectionModal(false);
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Error creating collection');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !selectedCollection) {
      alert('Please choose a file.');
      return;
    }
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('modelId', 'default');
      formData.append('collectionName', selectedCollection.name);

      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });
      if (response.ok) {
        alert('File uploaded successfully');
        setFile(null);
        fetchUploadedFiles(selectedCollection.name);
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUpdateSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCollection) return;
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections/${selectedCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: updatedCollectionName,
          permission: updatedCollectionPermission,
        }),
      });
      if (response.ok) {
        alert('Collection updated successfully');
        setSelectedCollection({ ...selectedCollection, name: updatedCollectionName, permission: updatedCollectionPermission });
        setShowSettings(false);
        fetchCollections();
        fetchUploadedFiles(updatedCollectionName);
      } else {
        alert('Failed to update collection');
      }
    } catch (error) {
      console.error('Error updating collection:', error);
    }
  };

  const handleDeleteCollection = async (collection: Collection) => {
    if (!window.confirm(`Are you sure you want to delete collection "${collection.name}"?`)) return;
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections/${collection.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete collection');
      alert('Collection deleted successfully');
      if (selectedCollection && selectedCollection.id === collection.id) {
        setSelectedCollection(null);
      }
      fetchCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      alert('Error deleting collection');
    }
  };

  const filteredCollections = collections.filter((collection) =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ----------------------
  // Render
  // ----------------------
  return (
    <div className="container mx-auto p-4 font-sans relative">
      <DashboardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewCollectionToggle={() => setShowNewCollectionModal(true)}
      />

      {isCollectionsLoading ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-300">Loading collections...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onSelect={() => setSelectedCollection(collection)}
              activeDropdown={activeDropdownId === collection.id}
              onDropdownToggle={() =>
                setActiveDropdownId(activeDropdownId === collection.id ? null : collection.id)
              }
              onSettings={() => {
                setSelectedCollection(collection);
                setShowSettings(true);
                setActiveDropdownId(null);
              }}
              onDelete={() => {
                setActiveDropdownId(null);
                handleDeleteCollection(collection);
              }}
            />
          ))}
        </div>
      )}

      {selectedCollection && (
        <CollectionModal
          collection={selectedCollection}
          onClose={() => setSelectedCollection(null)}
          uploadedFiles={uploadedFiles}
          onFileChange={handleFileChange}
          onFileUpload={handleFileUpload}
          uploadLoading={uploadLoading}
          onShowSettings={() => setShowSettings(true)}
        />
      )}

      {showSettings && selectedCollection && (
        <SettingsModal
          updatedCollectionName={updatedCollectionName}
          updatedCollectionPermission={updatedCollectionPermission}
          onNameChange={setUpdatedCollectionName}
          onPermissionChange={setUpdatedCollectionPermission}
          onClose={() => setShowSettings(false)}
          onSubmit={handleUpdateSettings}
        />
      )}

      {showNewCollectionModal && (
        <NewCollectionModal
          newCollectionName={newCollectionName}
          newCollectionPermission={newCollectionPermission}
          onNameChange={setNewCollectionName}
          onPermissionChange={setNewCollectionPermission}
          onSubmit={handleCreateCollection}
          onCancel={() => {
            setShowNewCollectionModal(false);
            setNewCollectionName('');
          }}
        />
      )}
    </div>
  );
};

export default TrainingDashboard;
