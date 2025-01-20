import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';

interface TrainingData {
  _id: string;
  content: string;
  createdBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  isActive: boolean;
  createdAt: string;
}

const TrainAI: React.FC = () => {
  const [text, setText] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [message, setMessage] = useState('');
  const [trainingHistory, setTrainingHistory] = useState<TrainingData[]>([]);

  // โหลดข้อมูลประวัติการ train
  const loadTrainingHistory = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/train-ai/training-data`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setTrainingHistory(response.data);
    } catch (error) {
      console.error('Error loading training history:', error);
    }
  };

  const handleTrain = async () => {
    try {
      setIsTraining(true);
      setMessage('Training AI...');

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setMessage('Please log in again');
        return;
      }

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/train-ai/train`, 
        { text }, 
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setMessage('Training AI successful!');
      setText('');
      await loadTrainingHistory();
    } catch (error: unknown) {
      console.error('Training error:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      setMessage(axiosError.response?.data?.message || 'An error occurred during training');
    } finally {
      setIsTraining(false);
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

  useEffect(() => {
    loadTrainingHistory();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Train AI</h1>
        
        <div className="mb-4">
          <textarea
            className="w-full p-2 border rounded"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter data to train AI..."
          />
        </div>

        <button
          className={`px-4 py-2 rounded ${
            isTraining ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
          onClick={handleTrain}
          disabled={isTraining}
        >
          {isTraining ? 'Training...' : 'Start Training'}
        </button>

        {message && (
          <div className="mt-4 text-center text-sm">
            {message}
          </div>
        )}

        {/* Training history */}
        <div>
          <h2 className="text-xl font-bold mb-4 mt-4">History Training</h2>
          {trainingHistory.map((item) => (
            <div 
              key={item._id} 
              className={`mb-4 p-4 border rounded transition-all duration-200 ${
                item.isActive 
                  ? 'bg-white' 
                  : 'bg-gray-200 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className={`whitespace-pre-wrap ${!item.isActive && 'text-gray-600'}`}>
                    {item.content}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Added on: {new Date(item.createdAt).toLocaleString('th-TH')}
                  </p>
                </div>
                <button
                  onClick={() => toggleTrainingData(item._id, item.isActive)}
                  className={`ml-4 px-4 py-2 rounded text-sm transition-colors ${
                    item.isActive 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {item.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrainAI; 