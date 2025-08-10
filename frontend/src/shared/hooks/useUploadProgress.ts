import { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useUIStore } from '../stores/uiStore';

export interface UploadProgressState {
  jobId: string;
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: {
    chunksCount: number;
    processingTime: number;
  };
}

export interface UseUploadProgressReturn {
  uploads: Map<string, UploadProgressState>;
  isUploading: boolean;
  addUpload: (jobId: string, fileName: string) => void;
  removeUpload: (jobId: string) => void;
  clearCompleted: () => void;
  getUploadByJobId: (jobId: string) => UploadProgressState | undefined;
}

export const useUploadProgress = (): UseUploadProgressReturn => {
  const [uploads, setUploads] = useState<Map<string, UploadProgressState>>(new Map());
  const { isConnected } = useWebSocket();
  const { addNotification } = useUIStore();

  // Check if any uploads are in progress
  const isUploading = Array.from(uploads.values()).some(
    upload => upload.status === 'queued' || upload.status === 'processing'
  );

  // Add new upload to tracking
  const addUpload = useCallback((jobId: string, fileName: string) => {
    const newUpload: UploadProgressState = {
      jobId,
      fileName,
      status: 'queued',
      progress: 0,
    };

    setUploads(prev => new Map(prev.set(jobId, newUpload)));

    // Add notification for upload started
    addNotification({
      type: 'info',
      title: 'Upload Started',
      message: `Started uploading ${fileName}`,
    });
  }, [addNotification]);

  // Remove upload from tracking
  const removeUpload = useCallback((jobId: string) => {
    setUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });
  }, []);

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setUploads(prev => {
      const newMap = new Map();
      for (const [jobId, upload] of prev) {
        if (upload.status !== 'completed' && upload.status !== 'failed') {
          newMap.set(jobId, upload);
        }
      }
      return newMap;
    });
  }, []);

  // Get upload by job ID
  const getUploadByJobId = useCallback((jobId: string) => {
    return uploads.get(jobId);
  }, [uploads]);

  // Listen for WebSocket progress updates
  useEffect(() => {
    if (!isConnected) return;

    const handleProgressUpdate = (event: CustomEvent) => {
      try {
        const data = JSON.parse(event.detail);
        
        if (data.type === 'upload-progress' && data.data) {
          const progressData = data.data;
          const { jobId, fileName, status, progress, error, result } = progressData;

          console.log('📊 Upload progress update received:', progressData);

          if (!jobId) return;

          setUploads(prev => {
            const existing = prev.get(jobId);
            if (!existing) {
              // If upload not tracked yet, add it
              const newUpload: UploadProgressState = {
                jobId,
                fileName: fileName || 'Unknown File',
                status: status || 'processing',
                progress: progress || 0,
                error,
                result,
              };
              console.log('📊 Adding new upload to tracker:', newUpload);
              return new Map(prev.set(jobId, newUpload));
            }

            // Update existing upload
            const updated: UploadProgressState = {
              ...existing,
              status: status || existing.status,
              progress: progress ?? existing.progress,
              error: error || existing.error,
              result: result || existing.result,
            };

            console.log('📊 Updating existing upload:', updated);
            return new Map(prev.set(jobId, updated));
          });

          // Add notifications for status changes
          if (status === 'completed') {
            addNotification({
              type: 'success',
              title: 'Upload Completed',
              message: `${fileName || 'File'} processed successfully${result?.chunksCount ? ` (${result.chunksCount} chunks)` : ''}`,
            });
          } else if (status === 'failed') {
            addNotification({
              type: 'error',
              title: 'Upload Failed',
              message: `Failed to process ${fileName || 'file'}: ${error || 'Unknown error'}`,
            });
          }
        }
      } catch (error) {
        console.error('Error parsing progress update:', error);
      }
    };

    // Listen for custom WebSocket message events
    window.addEventListener('websocket-message', handleProgressUpdate as EventListener);

    return () => {
      window.removeEventListener('websocket-message', handleProgressUpdate as EventListener);
    };
  }, [isConnected, addNotification]);

  return {
    uploads,
    isUploading,
    addUpload,
    removeUpload,
    clearCompleted,
    getUploadByJobId,
  };
};
