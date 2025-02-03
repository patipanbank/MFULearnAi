import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';
import { FaTrash, FaGlobe, FaFile } from 'react-icons/fa';
import { CollectionPermission } from '../../types/collection';

const TrainingDashboard: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  // const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [trainingMode, setTrainingMode] = useState<'file' | 'url'>('file');
  const [urls, setUrls] = useState<string>('');
  const [isProcessingUrls, setIsProcessingUrls] = useState(false);
  const [newCollectionPermission, setNewCollectionPermission] = useState(CollectionPermission.PRIVATE);

  useEffect(() => {
    fetchModels();
    fetchCollections();
  }, []);

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      const response = await fetch(`${config.apiUrl}/api/training/models`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      setModels(data);
      if (data.length === 1) {
        setSelectedModel(data[0]);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchCollections = async () => {
    try {
      setLoadingCollections(true);
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      const data = await response.json();
      
      // แก้ไขการกรอง collections
      const accessibleCollections = data.filter((collection: { 
        name: string;
        permission: CollectionPermission;
        createdBy: string;
      }) => {
        return (
          collection.permission === CollectionPermission.PUBLIC ||
          (collection.permission === CollectionPermission.STAFF_ONLY && userData.groups?.includes('Staffs')) ||
          (collection.permission === CollectionPermission.PRIVATE && collection.createdBy === userData.nameID)
        );
      }).map((collection: { name: string }) => collection.name);
      
      setCollections(accessibleCollections);
      if (accessibleCollections.length === 1) {
        setSelectedCollection(accessibleCollections[0]);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) {
      alert('Please enter collection name');
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ name: newCollectionName, permission: newCollectionPermission })
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
        setNewCollectionName('');
        setShowNewCollectionForm(false);
      } else {
        alert('Failed to create collection');
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Error creating collection');
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isUploading) {
      console.log('Upload already in progress');
      return;
    }

    if (!file || !selectedModel || !selectedCollection) {
      alert('กรุณาเลือก Model, Collection และไฟล์ให้ครบถ้วน');
      return;
    }

    setIsUploading(true);
    console.log('Starting upload...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('modelId', selectedModel);
      formData.append('collectionName', selectedCollection);

      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      alert('Upload file successfully');
      setFile(null);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload file failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCollection = async (collectionName: string) => {
    if (!window.confirm(`Are you sure you want to delete Collection "${collectionName}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${config.apiUrl}/api/training/collections/${encodeURIComponent(collectionName)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete collection');
      }

      fetchCollections();
    } catch (error) {
      console.error('Error:', error);
      alert('Cannot delete collection');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isProcessingUrls) {
      return;
    }

    if (!urls.trim() || !selectedModel || !selectedCollection) {
      alert('กรุณาเลือก Model, Collection และใส่ URLs ให้ครบถ้วน');
      return;
    }

    setIsProcessingUrls(true);

    try {
      const urlList = urls.split('\n').map(url => url.trim()).filter(url => url);
      
      const response = await fetch(`${config.apiUrl}/api/training/add-urls`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls: urlList,
          modelId: selectedModel,
          collectionName: selectedCollection
        })
      });

      if (!response.ok) {
        throw new Error('URL processing failed');
      }

      alert('URLs processed successfully');
      setUrls('');
    } catch (error) {
      console.error('URL processing error:', error);
      alert('Failed to process URLs');
    } finally {
      setIsProcessingUrls(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Training Dashboard</h1>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-gray-700 dark:text-white mb-2">Choose Model:</label>
          {loadingModels ? (
            <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
          ) : (
            <select 
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={models.length === 1}
            >
              <option value="">-- Choose Model --</option>
              {models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-700 dark:text-white">Choose Collection:</label>
            <button
              onClick={() => setShowNewCollectionForm(true)}
              className="text-blue-600 hover:text-blue-800"
            >
              + Create New Collection
            </button>
          </div>
          
          {loadingCollections ? (
            <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">-- Choose Collection --</option>
                {collections.map(collection => (
                  <option key={collection} value={collection}>{collection}</option>
                ))}
              </select>
              {selectedCollection && (
                <button
                  onClick={() => handleDeleteCollection(selectedCollection)}
                  className="mt-1 p-2 text-red-600 hover:text-red-800"
                  title="Delete Collection"
                >
                  <FaTrash />
                </button>
              )}
            </div>
          )}
        </div>

        {showNewCollectionForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg">
              <h2 className="text-xl mb-4">Create New Collection</h2>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                className="border p-2 rounded w-full mb-4"
                placeholder="Collection Name"
              />
              <div className="mb-4">
                <label>Collection Permission:</label>
                <select 
                  value={newCollectionPermission}
                  onChange={(e) => setNewCollectionPermission(e.target.value as CollectionPermission)}
                  className="ml-2 p-2 border rounded"
                >
                  <option value={CollectionPermission.PUBLIC}>Public</option>
                  <option value={CollectionPermission.STAFF_ONLY}>Staff Only</option>
                  <option value={CollectionPermission.PRIVATE}>Private</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewCollectionForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCollection}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedModel && selectedCollection && (
          <div className="mt-6">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setTrainingMode('file')}
                className={`flex items-center gap-2 px-4 py-2 rounded ${
                  trainingMode === 'file' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                <FaFile /> File Upload
              </button>
              <button
                onClick={() => setTrainingMode('url')}
                className={`flex items-center gap-2 px-4 py-2 rounded ${
                  trainingMode === 'url' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                <FaGlobe /> URL Training
              </button>
            </div>

            {trainingMode === 'file' ? (
              <form onSubmit={handleFileUpload}>
                <div className="mb-4">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                    disabled={isUploading}
                    accept=".txt,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!file || isUploading || !selectedModel || !selectedCollection}
                  className={`px-4 py-2 rounded text-white
                    ${isUploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}
                  `}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleUrlSubmit}>
                <div className="mb-4">
                  <textarea
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                    placeholder="ใส่ URLs (1 URL ต่อบรรทัด)"
                    className="w-full h-40 p-2 border rounded"
                    disabled={isProcessingUrls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!urls.trim() || isProcessingUrls}
                  className={`px-4 py-2 rounded text-white
                    ${isProcessingUrls ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}
                  `}
                >
                  {isProcessingUrls ? 'Processing URLs...' : 'Process URLs'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingDashboard; 