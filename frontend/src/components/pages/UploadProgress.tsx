import React from 'react';
import { FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';

export interface UploadProgressState {
  status: 'idle' | 'validating' | 'extracting' | 'chunking' | 'embedding' | 'uploading' | 'success' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

interface UploadProgressProps {
  progress: UploadProgressState;
  fileName: string;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ progress, fileName }) => {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'success':
        return <FaCheckCircle className="text-green-500" />;
      case 'error':
        return <FaTimesCircle className="text-red-500" />;
      case 'idle':
        return null;
      default:
        return <FaSpinner className="animate-spin text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (progress.status === 'idle') {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {fileName}
          </span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {progress.progress}%
        </span>
      </div>
      
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {progress.message}
      </p>
      
      {progress.error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
          {progress.error}
        </div>
      )}
    </div>
  );
};

export default UploadProgress;
