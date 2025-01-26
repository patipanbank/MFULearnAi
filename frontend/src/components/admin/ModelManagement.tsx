import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Model {
  name: string;
  size: string;
}

const ModelManagement: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [newModelName, setNewModelName] = useState('');
  const [loading, setLoading] = useState(false);

  // โหลดรายการ models
  const loadModels = async () => {
    try {
      const response = await axios.get('/api/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  // ดาวน์โหลด model ใหม่
  const handlePullModel = async () => {
    if (!newModelName) return;
    
    setLoading(true);
    try {
      await axios.post('/api/models/pull', { modelName: newModelName });
      await loadModels();
      setNewModelName('');
    } catch (error) {
      console.error('Error pulling model:', error);
    } finally {
      setLoading(false);
    }
  };

  // ลบ model
  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;
    
    try {
      await axios.delete(`/api/models/${modelName}`);
      await loadModels();
    } catch (error) {
      console.error('Error deleting model:', error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Model Management</h2>
      
      {/* Pull New Model */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Pull New Model</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            placeholder="Enter model name (e.g., llama2)"
            className="flex-1 border p-2 rounded"
          />
          <button
            onClick={handlePullModel}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            {loading ? 'Pulling...' : 'Pull Model'}
          </button>
        </div>
      </div>
      
      {/* Model List */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Installed Models</h3>
        <div className="grid gap-4">
          {models.map((model) => (
            <div key={model.name} className="border p-4 rounded flex justify-between items-center">
              <div>
                <h4 className="font-medium">{model.name}</h4>
                <p className="text-sm text-gray-600">{model.size}</p>
              </div>
              <button
                onClick={() => handleDeleteModel(model.name)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModelManagement; 