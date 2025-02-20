import React, { useState, useEffect, ChangeEvent } from 'react';
import { config } from '../../config/config';
import { FaPlus, FaTimes, FaCog, FaEllipsisH } from 'react-icons/fa';

/**
 * Interface representing a collection from the API.
 */
interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission?: string;
}

/**
 * Interface representing an uploaded file.
 */
interface UploadedFile {
  filename: string;
  uploadedBy: string;
  timestamp: string;
  ids: string[];
}

const KnowledgeDashboard: React.FC = () => {
  // Dashboard state and collection creation states.
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNewCollectionForm, setShowNewCollectionForm] = useState<boolean>(false);
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [newCollectionPermission, setNewCollectionPermission] = useState<string>('PRIVATE');

  // State to control which collection is selected (for management modal).
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  // State to know which card's ellipsis menu is active.
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Collection management modal inner states.
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);

  // States for updating collection settings.
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [updatedCollectionName, setUpdatedCollectionName] = useState<string>('');
  const [updatedCollectionPermission, setUpdatedCollectionPermission] = useState<string>('PRIVATE');

  useEffect(() => {
    fetchCollections();
  }, []);

  // Fetch collections from the API.
  const fetchCollections = async (): Promise<void> => {
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      const data = await response.json();
      const collectionsWithDate: Collection[] = data.map((collection: any) => ({
        ...collection,
        created: collection.created || new Date().toISOString()
      }));
      setCollections(collectionsWithDate);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  // Returns a relative time string.
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

  // Create a new collection.
  const handleCreateCollection = async (e: React.FormEvent) => {
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
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: newCollectionName,
          permission: newCollectionPermission
        })
      });
      if (!response.ok) {
        throw new Error('Failed to create collection');
      }
      fetchCollections();
      setNewCollectionName('');
      setShowNewCollectionForm(false);
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Error creating collection');
    }
  };

  // Filter collections based on the search query.
  const filteredCollections = collections.filter((collection) =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // When selectedCollection is set, update modal settings and fetch uploaded files.
  useEffect(() => {
    if (selectedCollection) {
      setUpdatedCollectionName(selectedCollection.name);
      setUpdatedCollectionPermission(selectedCollection.permission || 'PRIVATE');
      fetchUploadedFiles(selectedCollection.name);
    }
  }, [selectedCollection]);

  // Fetch files for the selected collection.
  const fetchUploadedFiles = async (collectionName: string): Promise<void> => {
    try {
      const response = await fetch(
        `${config.apiUrl}/api/training/documents?collectionName=${encodeURIComponent(collectionName)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setUploadedFiles(data);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
    }
  };

  // Handle file selection.
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Upload selected file for the collection.
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedCollection) {
      alert('Please choose a file.');
      return;
    }
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('modelId', 'default'); // Adjust if needed.
      formData.append('collectionName', selectedCollection.name);
      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
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

  // Update collection settings (rename and change permission).
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection) return;
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections/${selectedCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: updatedCollectionName,
          permission: updatedCollectionPermission
        })
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

  // Delete the given collection.
  const handleDeleteCollection = async (collection: Collection) => {
    if (!window.confirm(`Are you sure you want to delete collection "${collection.name}"?`)) return;
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections/${collection.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete collection');
      }
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

  return (
    <div className="container mx-auto p-4 font-sans relative">
      {/* Header: Dashboard title, search bar, and create collection icon */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center w-full">
          <h1 className="text-3xl font-bold mr-4">Knowledge 11</h1>
          <input
            type="text"
            placeholder="Search Knowledge"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded px-4 py-2 flex-grow"
          />
          <button
            type="button"
            onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
            className="ml-2 text-xl p-2 bg-blue-500 rounded-full text-white"
            title="Create Collection"
          >
            <FaPlus />
          </button>
        </div>
      </header>

      {/* New Collection Form */}
      {showNewCollectionForm && (
        <form onSubmit={handleCreateCollection} className="mb-4 flex items-center">
          <input
            type="text"
            placeholder="New Collection Name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            className="border border-gray-300 rounded px-4 py-2 w-full mr-2"
          />
          <select
            value={newCollectionPermission}
            onChange={(e) => setNewCollectionPermission(e.target.value)}
            className="border border-gray-300 rounded px-4 py-2 mr-2"
          >
            <option value="PRIVATE">Private</option>
            <option value="STAFF_ONLY">Staff Only</option>
            <option value="PUBLIC">Public</option>
          </select>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewCollectionForm(false);
              setNewCollectionName('');
            }}
            className="ml-2 text-red-500 text-xl"
            title="Cancel"
          >
            <FaTimes />
          </button>
        </form>
      )}

      {/* Collection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 relative">
        {filteredCollections.map((collection) => (
          <div
            key={collection.id}
            className="relative border border-gray-200 rounded p-4 shadow hover:shadow-md transition-shadow duration-200 cursor-pointer"
            onClick={() => setSelectedCollection(collection)}
          >
            {/* Ellipsis button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdownId(activeDropdownId === collection.id ? null : collection.id);
              }}
              className="absolute top-2 right-2 p-1 text-gray-600 hover:text-gray-800"
              title="Options"
            >
              <FaEllipsisH />
            </button>
            {/* Dropdown menu for "Settings" and "Delete" */}
            {activeDropdownId === collection.id && (
              <div className="absolute top-8 right-2 bg-white border border-gray-300 rounded shadow z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCollection(collection);
                    setShowSettings(true);
                    setActiveDropdownId(null);
                  }}
                  className="block px-4 py-2 hover:bg-gray-100 w-full text-left"
                >
                  Settings
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdownId(null);
                    handleDeleteCollection(collection);
                  }}
                  className="block px-4 py-2 hover:bg-gray-100 w-full text-left"
                >
                  Delete
                </button>
              </div>
            )}
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">COLLECTION</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{collection.name}</h2>
            <p className="text-sm text-gray-600 mb-1">By {collection.createdBy}</p>
            <p className="text-sm text-gray-500">{getRelativeTime(collection.created)}</p>
          </div>
        ))}
      </div>

      {/* Collection Management Modal */}
      {selectedCollection && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded p-6 w-full md:w-2/3 lg:w-1/2 relative overflow-y-auto max-h-full">
            <button onClick={() => setSelectedCollection(null)} className="absolute top-2 right-2" title="Close">
              <FaTimes size={20} />
            </button>
            {/* Management Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{selectedCollection.name}</h2>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
                title="Collection Settings"
              >
                <FaCog size={20} />
              </button>
            </div>
            {/* File Upload Section */}
            <section className="mb-6">
              <h3 className="text-xl font-semibold mb-2">Upload File</h3>
              <form onSubmit={handleFileUpload} className="flex flex-col sm:flex-row items-start sm:items-center">
                <input type="file" onChange={handleFileChange} className="mb-2 sm:mb-0 sm:mr-2" />
                <button type="submit" disabled={uploadLoading} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                  {uploadLoading ? 'Uploading...' : 'Upload'}
                </button>
              </form>
            </section>
            {/* File Management Section */}
            <section>
              <h3 className="text-xl font-semibold mb-2">Files in the Collection</h3>
              {uploadedFiles.length > 0 ? (
                <ul className="space-y-2">
                  {uploadedFiles.map((fileItem, index) => (
                    <li key={index} className="border border-gray-300 rounded p-2">
                      <div className="font-semibold">{fileItem.filename}</div>
                      <div className="text-sm text-gray-600">Uploaded by: {fileItem.uploadedBy}</div>
                      <div className="text-sm text-gray-500">
                        At: {new Date(fileItem.timestamp).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">Chunks: {fileItem.ids.length}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No files uploaded yet.</p>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Settings Modal (Nested) */}
      {showSettings && selectedCollection && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-60">
          <div className="bg-white rounded p-6 w-80">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Collection Settings</h3>
              <button onClick={() => setShowSettings(false)} title="Close">
                <FaTimes size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateSettings}>
              <div className="mb-4">
                <label className="block mb-1">Collection Name</label>
                <input
                  type="text"
                  value={updatedCollectionName}
                  onChange={(e) => setUpdatedCollectionName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Permission</label>
                <select
                  value={updatedCollectionPermission}
                  onChange={(e) => setUpdatedCollectionPermission(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1"
                >
                  <option value="PRIVATE">Private</option>
                  <option value="STAFF_ONLY">Staff Only</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
              <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded w-full">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeDashboard;