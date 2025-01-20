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
      setMessage('กำลังเทรน AI...');

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setMessage('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/train-ai/train`, 
        { text }, 
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setMessage('เทรน AI สำเร็จ!');
      setText('');
      await loadTrainingHistory();
    } catch (error: unknown) {
      console.error('Training error:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      setMessage(axiosError.response?.data?.message || 'เกิดข้อผิดพลาดในการเทรน');
    } finally {
      setIsTraining(false);
    }
  };

  const toggleTrainingData = async (id: string, currentStatus: boolean) => {
    try {
      setMessage('กำลังอัพเดทสถานะ...');
      const token = localStorage.getItem('auth_token');
      
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/train-ai/training-data/${id}`,
        { isActive: !currentStatus },  // สลับสถานะ
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      await loadTrainingHistory();  // โหลดข้อมูลใหม่
      setMessage(currentStatus ? 'ปิดใช้งานสำเร็จ' : 'เปิดใช้งานสำเร็จ');
    } catch (error) {
      console.error('Error toggling training data:', error);
      setMessage('เกิดข้อผิดพลาดในการอัพเดทสถานะ');
    }
  };

  useEffect(() => {
    loadTrainingHistory();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Train AI</h1>
      
      {/* Training form */}
      <div className="mb-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-32 p-2 border rounded"
          placeholder="ใส่ข้อมูลที่ต้องการให้ AI เรียนรู้..."
        />
        <button
          onClick={handleTrain}
          disabled={isTraining}
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isTraining ? 'กำลังเทรน...' : 'เริ่มเทรน'}
        </button>
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
      </div>

      {/* Training history */}
      <div>
        <h2 className="text-xl font-bold mb-4">ประวัติการเทรน</h2>
        {trainingHistory.map((item) => (
          <div key={item._id} className="mb-4 p-4 border rounded">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="whitespace-pre-wrap">{item.content}</p>
                <p className="text-sm text-gray-500 mt-2">
                  เพิ่มเมื่อ: {new Date(item.createdAt).toLocaleString('th-TH')}
                </p>
              </div>
              <button
                onClick={() => toggleTrainingData(item._id, item.isActive)}
                className={`ml-4 px-4 py-2 rounded text-sm ${
                  item.isActive 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {item.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainAI; 