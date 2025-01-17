import React, { useState } from 'react';
import axios from 'axios';

const TrainAI: React.FC = () => {
  const [text, setText] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [message, setMessage] = useState('');

  const handleTrain = async () => {
    try {
      setIsTraining(true);
      setMessage('กำลังเทรน AI...');

      const token = localStorage.getItem('auth_token');
      
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/train-ai/train`, 
        { text }, 
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      setMessage('เทรน AI สำเร็จ!');
    } catch (error: unknown) {
      console.error('Training error:', error);
      setMessage('เกิดข้อผิดพลาดในการเทรน');
    } finally {
      setIsTraining(false);
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
      </div>
    </div>
  );
};

export default TrainAI; 