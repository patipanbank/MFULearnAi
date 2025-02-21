import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';
import { BiLoaderAlt } from 'react-icons/bi';

const ModelCreation: React.FC = () => {
  const [modelName, setModelName] = useState('');
  const [modelType, setModelType] = useState<'default' | 'custom'>('default');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch collections only when modelType is custom.
  useEffect(() => {
    if (modelType === 'custom') {
      const fetchCollections = async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        try {
          const response = await fetch(`${config.apiUrl}/api/chat/collections`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
            const collectionsData = await response.json();
            if (Array.isArray(collectionsData)) {
              setCollections(collectionsData);
              if (collectionsData.length > 0 && !selectedCollection) {
                setSelectedCollection(collectionsData[0]);
              }
            }
          } else {
            console.error('Failed to fetch collections');
            setMessage('Failed to fetch collections.');
          }
        } catch (err) {
          console.error(err);
          setMessage('Error occurred while fetching collections.');
        }
      };
      fetchCollections();
    }
  }, [modelType]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!modelName.trim()) {
      setMessage('Model name is required.');
      return;
    }

    if (modelType === 'custom' && !selectedCollection) {
      setMessage('Please select a collection for a custom model.');
      return;
    }

    // Build the payload. For a custom model, include the chosen collection name.
    const payload: any = {
      name: modelName,
      type: modelType,
    };
    if (modelType === 'custom') {
      payload.collectionName = selectedCollection;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await response.json();
        setMessage('Model created successfully!');
        setModelName('');
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Error creating model.');
      }
    } catch (error) {
      console.error(error);
      setMessage('Error creating model.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded shadow">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Create New Model</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="modelName"
              className="block text-gray-700 dark:text-gray-300 mb-2"
            >
              Model Name
            </label>
            <input
              type="text"
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Enter model name"
              required
              className="w-full p-2 border rounded focus:outline-none focus:ring"
            />
          </div>

          <div className="mb-4">
            <p className="block text-gray-700 dark:text-gray-300 mb-2">Model Type</p>
            <div className="flex items-center mb-2">
              <input
                type="radio"
                id="defaultModel"
                name="modelType"
                value="default"
                checked={modelType === 'default'}
                onChange={() => setModelType('default')}
                className="mr-2"
              />
              <label htmlFor="defaultModel" className="text-gray-700 dark:text-gray-300">
                Default Model (No Collection)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="customModel"
                name="modelType"
                value="custom"
                checked={modelType === 'custom'}
                onChange={() => setModelType('custom')}
                className="mr-2"
              />
              <label htmlFor="customModel" className="text-gray-700 dark:text-gray-300">
                Custom Model (With Collection)
              </label>
            </div>
          </div>

          {modelType === 'custom' && (
            <div className="mb-4">
              <label
                htmlFor="collectionSelect"
                className="block text-gray-700 dark:text-gray-300 mb-2"
              >
                Select Collection
              </label>
              <select
                id="collectionSelect"
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring"
              >
                {collections.map((collection) => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
            </div>
          )}

          {message && <div className="mb-4 text-red-500">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors flex items-center justify-center"
          >
            {loading ? <BiLoaderAlt className="w-6 h-6 animate-spin" /> : 'Create Model'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ModelCreation; 