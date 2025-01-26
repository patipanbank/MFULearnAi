import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TrainModel: React.FC = () => {
  const [models, setModels] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      const response = await axios.get('/api/models');
      setModels(response.data);
    };
    loadModels();
  }, []);

  const handleCreateCollection = async () => {
    if (!newCollection) return;
    try {
      await axios.post('/api/collections', {
        name: newCollection,
        modelName: selectedModel
      });
      setCollections([...collections, newCollection]);
      setNewCollection('');
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  const handleTraining = async () => {
    if (!trainingFile || !selectedModel || !selectedCollection) {
      setStatus('Please select all required fields');
      return;
    }

    setIsTraining(true);
    setStatus('Training in progress...');
    
    const formData = new FormData();
    formData.append('file', trainingFile);
    formData.append('model', selectedModel);
    formData.append('collection', selectedCollection);
    
    try {
      await axios.post('/api/train', formData);
      setStatus('Training completed successfully!');
    } catch (error) {
      console.error('Training error:', error);
      setStatus('Training failed. Please try again.');
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Train Model</h1>
      
      <div className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full border rounded-md p-2"
          >
            <option value="">Choose a model</option>
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        {/* Collection Management */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collection
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newCollection}
              onChange={(e) => setNewCollection(e.target.value)}
              placeholder="New collection name"
              className="flex-1 border rounded-md p-2"
            />
            <button
              onClick={handleCreateCollection}
              className="bg-green-500 text-white px-4 py-2 rounded-md"
            >
              Create
            </button>
          </div>
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="w-full border rounded-md p-2"
          >
            <option value="">Choose a collection</option>
            {collections.map(collection => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Training File
          </label>
          <input
            type="file"
            onChange={(e) => setTrainingFile(e.target.files?.[0] || null)}
            className="w-full"
            accept=".txt,.pdf,.doc,.docx"
          />
        </div>

        {/* Training Button */}
        <div>
          <button
            onClick={handleTraining}
            disabled={isTraining}
            className={`w-full py-2 px-4 rounded-md text-white ${
              isTraining ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isTraining ? 'Training...' : 'Start Training'}
          </button>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-md ${
            status.includes('failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainModel; 