import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
// import { FaUpload } from 'react-icons/fa';

// FaFile, FaFilePdf, FaFileWord, FaFileExcel

interface TrainingData {
  _id: string;
  content: string;
  createdBy: {
    nameID: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  isActive: boolean;
  fileType?: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  originalFileName: string;
  modelName: string;
}

interface AIModel {
  _id: string;
  displayName: string;
  description: string;
  modelType: string;
}

interface KnowledgeBase {
  _id: string;
  displayName: string;
  description: string;
  baseModelId: string;
}

const TrainAI: React.FC = () => {
  // const [setIsTraining] = useState(false);
  const [message, setMessage] = useState('');
  const [trainingHistory, setTrainingHistory] = useState<TrainingData[]>([]);
  const [file, setFile] = useState<File | null>(null);
  // const [setUploadMessage] = useState('');
  // const [datasetName, setDatasetName] = useState('');
  // const [modelName] = useState('mfu-custom');
  const [models, setModels] = useState<AIModel[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [showNewKBForm, setShowNewKBForm] = useState(false);
  const [newKB, setNewKB] = useState({
    displayName: '',
    description: '',
  });
  const [content, setContent] = useState('');

  // โหลดข้อมูลประวัติการ train
  const loadTrainingHistory = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        setMessage('Please log in again');
        return;
      }

      console.log('Fetching training history...'); // debug log
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/train-ai/training-data`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      console.log('Training history response:', response.data); // debug log
      
      if (Array.isArray(response.data)) {
        setTrainingHistory(response.data);
      } else {
        console.error('Invalid response format:', response.data);
        setMessage('Data is not correct');
      }
    } catch (error: unknown) {
      console.error('Error loading training history:', error);
      const err = error as AxiosError<{ message: string }>;
      setMessage(err.response?.data?.message || 'An error occurred while loading history');
    }
  };

  const toggleTrainingData = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/train-ai/training-data/${id}`,
        { isActive: !currentStatus },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      await loadTrainingHistory();
    } catch (error) {
      console.error('Error toggling training data:', error);
    }
  };

  const deleteTrainingData = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this data?')) return;
    
    try {
      setMessage('Deleting data...');
      const token = localStorage.getItem('auth_token');
      
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/train-ai/training-data/${id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      await loadTrainingHistory();
      setMessage('Data deleted successfully');
    } catch (error) {
      console.error('Error deleting training data:', error);
      setMessage('An error occurred while deleting data');
    }
  };

  // const handleFileUpload = async () => {
  //   try {
  //     if (!datasetName.trim()) {
  //       setMessage('Please enter a dataset name');
  //       return;
  //     }

  //     setIsTraining(true);
  //     setMessage('Training AI...');

  //     const token = localStorage.getItem('auth_token');
  //     if (!token) {
  //       setMessage('Please log in again');
  //       return;
  //     }

  //     const formData = new FormData();
  //     formData.append('file', file!);
  //     formData.append('datasetName', datasetName);
  //     formData.append('modelName', modelName);

  //     const response = await axios.post(
  //       `${import.meta.env.VITE_API_URL}/api/train-ai/train/file`,
  //       formData,
  //       {
  //         headers: {
  //           'Authorization': `Bearer ${token}`,
  //           'Content-Type': 'multipart/form-data'
  //         }
  //       }
  //     );

  //     setMessage(`Training completed: ${response.data.name}`);
  //     setFile(null);
  //     setUploadMessage('');
  //     setDatasetName('');
  //     await loadTrainingHistory();
  //   } catch (error: unknown) {
  //     console.error('Training error:', error);
  //     const axiosError = error as AxiosError<{ message: string }>;
  //     setMessage(axiosError.response?.data?.message || 'An error occurred during training');
  //   } finally {
  //     setIsTraining(false);
  //   }
  // };

  useEffect(() => {
    loadTrainingHistory();
  }, [message]);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    if (selectedModel) {
      fetchKnowledgeBases(selectedModel);
    }
  }, [selectedModel]);

  const fetchModels = async () => {
    try {
      const response = await axios.get('/api/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const fetchKnowledgeBases = async (modelId: string) => {
    try {
      const response = await axios.get(`/api/knowledge-base/by-model/${modelId}`);
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    }
  };

  const handleCreateKB = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/knowledge-base', {
        ...newKB,
        baseModelId: selectedModel
      });
      setKnowledgeBases([...knowledgeBases, response.data]);
      setShowNewKBForm(false);
      setNewKB({ displayName: '', description: '' });
    } catch (error) {
      console.error('Error creating knowledge base:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel || !selectedKB) return;

    const formData = new FormData();
    formData.append('knowledgeBaseId', selectedKB);
    if (file) {
      formData.append('file', file);
    } else {
      formData.append('content', content);
    }

    try {
      await axios.post('/api/train-ai/add', formData);
      alert('Training data added successfully');
      setFile(null);
      setContent('');
    } catch (error) {
      console.error('Error adding training data:', error);
      alert('Error adding training data');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Train AI</h1>
        
        {/* Model Selection */}
        <div className="mb-6">
          <label className="block mb-2">Select Base Model:</label>
          <select 
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              setSelectedKB('');
            }}
            className="w-full p-2 border rounded"
          >
            <option value="">Select a model</option>
            {models.map(model => (
              <option key={model._id} value={model._id}>
                {model.displayName} - {model.description}
              </option>
            ))}
          </select>
        </div>

        {/* Knowledge Base Selection */}
        {selectedModel && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label>Select Knowledge Base:</label>
              <button
                type="button"
                onClick={() => setShowNewKBForm(true)}
                className="bg-green-500 text-white px-3 py-1 rounded text-sm"
              >
                Create New
              </button>
            </div>
            <select 
              value={selectedKB}
              onChange={(e) => setSelectedKB(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Select a knowledge base</option>
              {knowledgeBases.map(kb => (
                <option key={kb._id} value={kb._id}>
                  {kb.displayName} - {kb.description}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* New Knowledge Base Form */}
        {showNewKBForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg w-96">
              <h2 className="text-xl font-bold mb-4">Create New Knowledge Base</h2>
              <form onSubmit={handleCreateKB} className="space-y-4">
                <div>
                  <label className="block mb-2">Display Name:</label>
                  <input
                    type="text"
                    value={newKB.displayName}
                    onChange={(e) => setNewKB(prev => ({
                      ...prev,
                      displayName: e.target.value
                    }))}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2">Description:</label>
                  <textarea
                    value={newKB.description}
                    onChange={(e) => setNewKB(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowNewKBForm(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Training Data Form */}
        {selectedModel && selectedKB && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2">Upload File or Enter Text:</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mb-2"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2 border rounded"
                rows={5}
                placeholder="Or enter text here..."
              />
            </div>

            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
              disabled={!file && !content}
            >
              Add Training Data
            </button>
          </form>
        )}

        {message && (
          <div className="mt-4 text-center text-sm">
            {message}
          </div>
        )}

        {/* Training history */}
        <div>
          <h2 className="text-xl font-bold mb-4 mt-4">Training History</h2>
          {trainingHistory.map((item) => (
            <div key={item._id} className="mb-4 p-4 border rounded">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold">{item.name}</h3>
                  <p className="text-sm text-gray-500">
                    Original file: {item.originalFileName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Model: {item.modelName}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  item.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className={`whitespace-pre-wrap ${!item.isActive && 'text-gray-600'}`}>
                  {item.content}
                </p>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm text-gray-500">
                    <p>Added on: {new Date(item.createdAt).toLocaleString('th-TH')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleTrainingData(item._id, item.isActive)}
                      className={`px-4 py-2 rounded text-sm ${
                        item.isActive 
                          ? 'bg-red-500 hover:bg-red-600 text-white' 
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {item.isActive ? 'Inactive' : 'Active'}
                    </button>
                    <button
                      onClick={() => deleteTrainingData(item._id)}
                      className="px-4 py-2 rounded text-sm bg-gray-500 hover:bg-gray-600 text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))} 
        </div>
      </div>
    </div>
  );
};

export default TrainAI; 