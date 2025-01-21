import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { FaUpload, FaFile, FaFilePdf, FaFileWord, FaFileExcel } from 'react-icons/fa';

interface TrainingData {
  _id: string;
  content: string;
  createdBy: {
    firstName: string;
    lastName: string;
    nameID: string;
  };
  isActive: boolean;
  createdAt: string;
  fileType?: string;
}

const TrainAI: React.FC = () => {
  // const [text, setText] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [message, setMessage] = useState('');
  const [trainingHistory, setTrainingHistory] = useState<TrainingData[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');

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

  // const handleTrain = async () => {
  //   try {
  //     setIsTraining(true);
  //     setMessage('Training AI...');

  //     const token = localStorage.getItem('auth_token');
  //     if (!token) {
  //       setMessage('Please log in again');
  //       return;
  //     }

  //     await axios.post(
  //       `${import.meta.env.VITE_API_URL}/api/train-ai/train`, 
  //       { text }, 
  //       {
  //         headers: { 'Authorization': `Bearer ${token}` }
  //       }
  //     );

  //     setMessage('Training AI successful!');
  //     setText('');
  //     await loadTrainingHistory();
  //   } catch (error: unknown) {
  //     console.error('Training error:', error);
  //     const axiosError = error as AxiosError<{ message: string }>;
  //     setMessage(axiosError.response?.data?.message || 'An error occurred during training');
  //   } finally {
  //     setIsTraining(false);
  //   }
  // };

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

  const handleFileUpload = async () => {
    try {
      setIsTraining(true);
      setMessage('Training AI...');

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setMessage('Please log in again');
        return;
      }

      const formData = new FormData();
      formData.append('file', file!, file!.name);

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/train-ai/train/file`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage('Training AI successful!');
      setFile(null);
      setUploadMessage('');
      await loadTrainingHistory();
    } catch (error: unknown) {
      console.error('Training error:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      setMessage(axiosError.response?.data?.message || 'An error occurred during training');
    } finally {
      setIsTraining(false);
    }
  };

  // เพิ่มฟังก์ชันสำหรับแสดงไอคอนตามประเภทไฟล์
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FaFilePdf className="text-red-500" />;
      case 'docx':
        return <FaFileWord className="text-blue-500" />;
      case 'xlsx':
      case 'csv':
        return <FaFileExcel className="text-green-500" />;
      default:
        return <FaFile />;
    }
  };

  useEffect(() => {
    loadTrainingHistory();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Train AI</h1>
        
        {/* File upload section */}
        <div className="mb-6 border-b pb-6">
          <h2 className="text-xl font-bold mb-4">อัพโหลดไฟล์</h2>
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <input
                type="file"
                accept=".txt,.pdf,.docx,.xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    setFile(selectedFile);
                    setUploadMessage(selectedFile.name);
                  }
                }}
              />
              <div className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-gray-50">
                <FaUpload />
                <span>{uploadMessage || 'เลือกไฟล์'}</span>
              </div>
            </label>
            <button
              className={`px-4 py-2 rounded ${
                isTraining ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
              onClick={handleFileUpload}
              disabled={isTraining || !file}
            >
              {isTraining ? 'กำลัง Train...' : 'อัพโหลดและ Train'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            รองรับไฟล์ .txt, .pdf, .docx, .xlsx และ .csv ขนาดไม่เกิน 10MB
          </p>
        </div>

        {/* <div className="mb-4">
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
        </button> */}

        {message && (
          <div className="mt-4 text-center text-sm">
            {message}
          </div>
        )}

        {/* Training history */}
        <div>
          <h2 className="text-xl font-bold mb-4 mt-4">ประวัติการ Train</h2>
          {trainingHistory.map((item) => (
            <div key={item._id} className="mb-4 p-4 border rounded">
              <div className="flex items-center gap-2 mb-2">
                {item.fileType && getFileIcon(item.fileType)}
                <span className="text-sm text-gray-500">
                  {item.fileType ? `ไฟล์ ${item.fileType.toUpperCase()}` : 'ข้อความ'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <p className={`whitespace-pre-wrap ${!item.isActive && 'text-gray-600'}`}>
                      {item.content}
                    </p>
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    <p>Added on: {new Date(item.createdAt).toLocaleString('th-TH')}</p>
                  </div>
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
          ))} 
        </div>
      </div>
    </div>
  );
};

export default TrainAI; 