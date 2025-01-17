import React, { useState } from 'react';
import axios, { AxiosError } from 'axios';
import { config } from '../../config/config';

interface ErrorResponse {
  error: string;
}

const TrainAI: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleTraining = async () => {
    if (!file) {
      setStatus('กรุณาเลือกไฟล์');
      return;
    }

    setIsTraining(true);
    setStatus('กำลังอัพโหลดและเริ่มการ train...');
    setProgress(10);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('ไม่พบ token กรุณาเข้าสู่ระบบใหม่');
      }

      await axios.post(
        `${config.apiUrl}/api/train-ai/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 50) / progressEvent.total)
              : 0;
            setProgress(progress);
          }
        }
      );

      setProgress(100);
      setStatus('การ train เสร็จสมบูรณ์');
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error('Training error:', axiosError);
      if (axiosError.response?.status === 401) {
        setStatus('ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่');
        // อาจจะ redirect ไปหน้า login
        // window.location.href = '/login';
      } else {
        const errorMessage = (axiosError.response?.data as ErrorResponse)?.error || axiosError.message;
        setStatus(`เกิดข้อผิดพลาด: ${errorMessage}`);
      }
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Train AI Model
        </h1>
        
        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              className="hidden"
              id="fileUpload"
              accept=".txt,.pdf,.doc,.docx"
              onChange={handleFileChange}
            />
            <label
              htmlFor="fileUpload"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="w-12 h-12 text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-gray-600">
                {file ? file.name : 'คลิกเพื่อเลือกไฟล์'}
              </span>
              <span className="text-sm text-gray-500 mt-2">
                รองรับไฟล์: PDF, DOC, DOCX, TXT
              </span>
            </label>
          </div>

          {status && (
            <div className={`p-4 rounded ${
              status.includes('เกิดข้อผิดพลาด') 
                ? 'bg-red-100 text-red-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {status}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              สถานะการ Training
            </h2>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="ml-4 text-sm text-gray-600">{progress}%</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setFile(null);
                setStatus('');
                setProgress(0);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              disabled={isTraining}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleTraining}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
              disabled={!file || isTraining}
            >
              {isTraining ? 'กำลัง Train...' : 'เริ่ม Training'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainAI; 