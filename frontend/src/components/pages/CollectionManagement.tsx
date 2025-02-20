import React, { useState, useEffect, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { config } from '../../config/config';
import { FaCog, FaTimes } from 'react-icons/fa';

// Definition of Collection object fetched from the API.
interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission?: string;
}

// Definition of a file as returned by the API.
interface UploadedFile {
  filename: string;
  uploadedBy: string;
  timestamp: string;
  ids: string[];
}

const CollectionManagement: React.FC = () => {
  // Get the collection id (assumed to be passed via route params).
  const { id } = useParams<{ id: string }>();

  // State for the collection details.
  const [collection, setCollection] = useState<Collection | null>(null);
  // List of uploaded files for this collection.
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  // File selected for upload.
  const [file, setFile] = useState<File | null>(null);
  // Loading state for file upload.
  const [loading, setLoading] = useState<boolean>(false);

  // State for the settings modal.
  const [showSettings, setShowSettings] = useState<boolean>(false);
  // For the settings modal: new name and permission.
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [newCollectionPermission, setNewCollectionPermission] = useState<string>('PRIVATE');

  // Fetch collection details and its files on mount or when id changes.
  useEffect(() => {
    fetchCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch the collection details by calling the collections API and filtering by id.
  const fetchCollection = async (): Promise<void> => {
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
      // Filter the list to find the collection with the provided id.
      const found = data.find((col: any) => col.id === id);
      if (found) {
        setCollection(found);
        setNewCollectionName(found.name);
        if (found.permission) {
          setNewCollectionPermission(found.permission);
        }
        // Once collection is set, fetch its files.
        fetchUploadedFiles(found.name);
      }
    } catch (error) {
      console.error('Error fetching collection details:', error);
    }
  };

  // Fetch the files uploaded for this collection.
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

  // Handle file upload.
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !collection) {
      alert('Please choose a file.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Assuming modelId can be defaulted if not chosen by user.
      formData.append('modelId', 'default'); 
      formData.append('collectionName', collection.name);

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
        fetchUploadedFiles(collection.name);
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle updating the collection settings (rename and change permission).
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections/${collection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: newCollectionName,
          permission: newCollectionPermission
        })
      });
      if (response.ok) {
        alert('Collection updated successfully');
        // Update local state with the new settings.
        setCollection({ ...collection, name: newCollectionName, permission: newCollectionPermission });
        setShowSettings(false);
        // Refresh files in case the collection name is used in file queries.
        fetchUploadedFiles(newCollectionName);
      } else {
        alert('Failed to update collection');
      }
    } catch (error) {
      console.error('Error updating collection:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      {/* Header with collection title and settings icon */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {collection ? collection.name : "Loading..."}
        </h1>
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
        <h2 className="text-xl font-semibold mb-2">Upload File</h2>
        <form onSubmit={handleFileUpload} className="flex flex-col sm:flex-row items-start sm:items-center">
          <input
            type="file"
            onChange={handleFileChange}
            className="mb-2 sm:mb-0 sm:mr-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </section>

      {/* File Management Section */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Files in the Collection</h2>
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

      {/* Settings Modal */}
      {showSettings && collection && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
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
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Permission</label>
                <select
                  value={newCollectionPermission}
                  onChange={(e) => setNewCollectionPermission(e.target.value)}
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

export default CollectionManagement; 