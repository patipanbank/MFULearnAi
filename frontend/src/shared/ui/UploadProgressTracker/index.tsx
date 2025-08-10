import React from 'react';
import { useUploadProgress } from '../../hooks/useUploadProgress';

interface UploadProgressTrackerProps {
  className?: string;
}

const UploadProgressTracker: React.FC<UploadProgressTrackerProps> = ({ className = '' }) => {
  const { uploads, isUploading, clearCompleted } = useUploadProgress();

  const uploadList = Array.from(uploads.values());
  const activeUploads = uploadList.filter(upload => 
    upload.status === 'queued' || upload.status === 'processing'
  );
  const completedUploads = uploadList.filter(upload => 
    upload.status === 'completed' || upload.status === 'failed'
  );

  if (uploadList.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'processing':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Upload Progress
          </h3>
          {completedUploads.length > 0 && (
            <button
              onClick={clearCompleted}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear Completed
            </button>
          )}
        </div>
        
        {isUploading && (
          <div className="mt-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {activeUploads.length} file(s) uploading...
            </div>
          </div>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {uploadList.map((upload) => (
          <div
            key={upload.jobId}
            className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getStatusIcon(upload.status)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {upload.fileName}
                  </div>
                  <div className={`text-xs ${getStatusColor(upload.status)}`}>
                    {upload.status === 'processing' && `Processing... ${upload.progress}%`}
                    {upload.status === 'queued' && 'Queued for processing'}
                    {upload.status === 'completed' && 
                      `Completed${upload.result?.chunksCount ? ` (${upload.result.chunksCount} chunks)` : ''}`
                    }
                    {upload.status === 'failed' && `Failed: ${upload.error || 'Unknown error'}`}
                  </div>
                </div>
              </div>
              
              {upload.status === 'processing' && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {upload.progress}%
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {(upload.status === 'processing' || upload.status === 'completed') && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(upload.status)}`}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            )}

            {/* Result Details */}
            {upload.status === 'completed' && upload.result && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Processing time: {upload.result.processingTime ? `${upload.result.processingTime}ms` : 'N/A'}
              </div>
            )}

            {/* Error Details */}
            {upload.status === 'failed' && upload.error && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {upload.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadProgressTracker;
