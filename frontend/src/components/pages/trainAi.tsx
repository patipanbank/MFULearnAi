import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { FaUpload } from 'react-icons/fa';

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

const TrainAI: React.FC = () => {
  // const [text, setText] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [message, setMessage] = useState('');
  const [trainingHistory, setTrainingHistory] = useState<TrainingData[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [modelName, setModelName] = useState('mfu-custom');

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
      if (!datasetName.trim()) {
        setMessage('Please enter a dataset name');
        return;
      }

      setIsTraining(true);
      setMessage('Training AI...');

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setMessage('Please log in again');
        return;
      }

      const formData = new FormData();
      formData.append('file', file!);
      formData.append('datasetName', datasetName);
      formData.append('modelName', modelName);

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/train-ai/train/file`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage(`Training completed: ${response.data.name}`);
      setFile(null);
      setUploadMessage('');
      setDatasetName('');
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
  // const getFileIcon = (fileType: string) => {
  //   switch (fileType) {
  //     case 'pdf':
  //       return <FaFilePdf className="text-red-500" />;
  //     case 'docx':
  //       return <FaFileWord className="text-blue-500" />;
  //     case 'xlsx':
  //     case 'csv':
  //       return <FaFileExcel className="text-green-500" />;
  //     default:
  //       return <FaFile />;
  //   }
  // };

  useEffect(() => {
    loadTrainingHistory();
  }, [message]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Train AI</h1>
        
        {/* File upload section */}
        <div className="mb-6 border-b pb-6">
          <h2 className="text-xl font-bold mb-4">อัพโหลดข้อมูลสำหรับ Training</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">ชื่อชุดข้อมูล</label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="ระบุชื่อชุดข้อมูล"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">ชื่อโมเดล</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="ระบุชื่อโมเดล (ค่าเริ่มต้น: mfu-custom)"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* File upload UI */}
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".txt,.pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
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
                disabled={isTraining || !file || !datasetName.trim()}
              >
                {isTraining ? 'กำลัง Training...' : 'อัพโหลดและ Train'}
              </button>
            </div>
          </div>
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