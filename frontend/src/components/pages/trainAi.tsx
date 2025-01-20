import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/train-ai/training-data`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setTrainingHistory(response.data);
    } catch (error) {
      console.error('Error loading training history:', error);
    }
  };

  useEffect(() => {
    loadTrainingHistory();
  }, []);

  const handleTrain = async () => {
    try {
      setIsTraining(true);
      setMessage('กำลังเทรน AI...');

      const token = localStorage.getItem('auth_token');
      
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/train-ai/train`, 
        { text }, 
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMessage('เทรน AI สำเร็จ!');
      setText('');
      loadTrainingHistory(); // โหลดข้อมูลใหม่หลัง train
    } catch (error: Error | unknown) {
      console.error('Training error:', error);
      setMessage('เกิดข้อผิดพลาดในการเทรน');
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
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      loadTrainingHistory();
    } catch (error) {
      console.error('Error toggling training data:', error);
    }
  };

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
            placeholder="ใส่ข้อมูลที่ต้องการให้ AI เรียนรู้..."
          />
        </div>

        <button
          className={`px-4 py-2 rounded ${
            isTraining ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
          onClick={handleTrain}
          disabled={isTraining}
        >
          {isTraining ? 'กำลังเทรน...' : 'เริ่มเทรน'}
        </button>

        {message && (
          <div className="mt-4 text-center text-sm">
            {message}
          </div>
        )}

        {/* แสดงประวัติการ train */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">ประวัติการเทรน</h2>
          <div className="space-y-4">
            {trainingHistory.map((item) => (
              <div 
                key={item._id} 
                className={`p-4 border rounded ${item.isActive ? 'bg-white' : 'bg-gray-100'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap">{item.content}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      เพิ่มโดย: {item.createdBy.firstName} {item.createdBy.lastName}
                      <br />
                      เมื่อ: {new Date(item.createdAt).toLocaleString('th-TH')}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleTrainingData(item._id, item.isActive)}
                    className={`ml-4 px-3 py-1 rounded text-sm ${
                      item.isActive 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {item.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainAI; 