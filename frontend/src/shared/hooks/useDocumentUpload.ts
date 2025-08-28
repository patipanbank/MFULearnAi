import { useState } from 'react';
import { api } from '../lib/api';
import { useUIStore } from '../stores';
import { useUploadProgress } from './useUploadProgress';

export interface FileWithStatus {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface UseDocumentUploadOptions {
  onUploadComplete?: () => void;
  validateFiles?: boolean;
}

export const useDocumentUpload = (options: UseDocumentUploadOptions = {}) => {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useUIStore();
  const { addUpload } = useUploadProgress();

  // Constants
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
  const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'doc', 'docx', 'csv', 'xls', 'xlsx'];

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (max 100MB)`;
    }

    // Check file type by extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return `Unsupported file type`;
    }

    return null;
  };

  const addFiles = (selectedFiles: File[]) => {
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    selectedFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        rejectedFiles.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    // Show rejected files as toast messages
    if (rejectedFiles.length > 0 && options.validateFiles !== false) {
      rejectedFiles.forEach(error => {
        addToast({
          type: 'error',
          title: 'File Rejected',
          message: error
        });
      });
    }

    const newFiles: FileWithStatus[] = validFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: 'pending' as const,
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    return newFiles;
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const createUploadFormData = (file: File, collectionName: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('modelId', 'amazon.titan-embed-text-v1');
    formData.append('collectionName', collectionName);
    
    const useQueue = file.size > LARGE_FILE_THRESHOLD;
    if (useQueue) {
      formData.append('useQueue', 'true');
    }
    
    return { formData, useQueue };
  };

  const uploadSingleFile = async (
    fileWithStatus: FileWithStatus,
    index: number,
    collectionName: string
  ) => {
    try {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ));

      const { file } = fileWithStatus;
      const { formData, useQueue } = createUploadFormData(file, collectionName);

      console.log('📁 Uploading file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        collectionName: collectionName,
        useQueue: useQueue
      });

      const response = await api.post('/training/upload', formData, {
        headers: {
          // Don't set Content-Type - let browser set it with proper boundary
        },
        onUploadProgress: (progressEvent) => {
          const uploadProgress = progressEvent.total 
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          
          // For large files, show upload progress up to 50%
          // For small files, show upload progress up to 90%
          const maxProgress = useQueue ? 50 : 90;
          
          setFiles(prev => prev.map((f, i) => 
            i === index ? { ...f, progress: Math.min(uploadProgress, maxProgress) } : f
          ));
        }
      });

      const responseData = (response as any).data;

      if (responseData.queued) {
        // File queued for background processing
        console.log(`📋 File ${fileWithStatus.file.name} queued with job ID: ${responseData.jobId}`);
        
        addUpload(responseData.jobId, fileWithStatus.file.name);
        
        setFiles(prev => prev.map((f, i) => 
          i === index ? { 
            ...f, 
            status: 'success' as const, 
            progress: 100,
            error: `Queued for background processing (Job ID: ${responseData.jobId})`
          } : f
        ));
        
        addToast({
          type: 'info',
          title: 'File Queued',
          message: `${file.name} has been queued for background processing. You'll receive updates via WebSocket.`
        });
      } else {
        // File processed immediately
        setFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, status: 'success' as const, progress: 100 } : f
        ));
        
        addToast({
          type: 'success',
          title: 'Upload Complete',
          message: `${file.name} processed successfully (${responseData.chunks} chunks)`
        });
      }

      return response;
    } catch (error: any) {
      console.error(`Error uploading ${fileWithStatus.file.name}:`, error);
      
      let errorMessage = 'Upload failed';
      if (error?.response?.status === 413) {
        errorMessage = 'File too large. Maximum size is 100MB.';
      } else if (error?.response?.status === 400) {
        errorMessage = error.response.data?.error || 'Invalid file or request';
      } else if (error?.response?.status === 500) {
        errorMessage = 'Server error during upload. Please try again.';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          status: 'error' as const, 
          error: errorMessage
        } : f
      ));
      
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: `Failed to upload ${fileWithStatus.file.name}: ${errorMessage}`
      });
      
      throw error;
    }
  };

  const uploadFiles = async (collectionName: string) => {
    if (files.length === 0) return;

    setIsUploading(true);
    
    const uploadPromises = files.map((fileWithStatus, index) =>
      uploadSingleFile(fileWithStatus, index, collectionName)
    );

    try {
      await Promise.all(uploadPromises);
      
      const queuedFiles = files.filter(f => f.file.size > LARGE_FILE_THRESHOLD);
      const immediateFiles = files.filter(f => f.file.size <= LARGE_FILE_THRESHOLD);
      
      if (queuedFiles.length > 0 && immediateFiles.length > 0) {
        addToast({
          type: 'info',
          title: 'Mixed Upload Complete',
          message: `${immediateFiles.length} file(s) processed immediately, ${queuedFiles.length} file(s) queued for background processing`
        });
      } else if (immediateFiles.length === files.length) {
        addToast({
          type: 'success',
          title: 'Upload Complete',
          message: `Successfully uploaded ${files.length} document(s) to ${collectionName}`
        });
      }
      
      if (options.onUploadComplete) {
        options.onUploadComplete();
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: 'Some files failed to upload. Please check the errors and try again.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearFiles = () => {
    setFiles([]);
  };

  return {
    files,
    isUploading,
    addFiles,
    removeFile,
    uploadFiles,
    clearFiles,
    constants: {
      MAX_FILE_SIZE,
      LARGE_FILE_THRESHOLD,
      ALLOWED_EXTENSIONS
    }
  };
};