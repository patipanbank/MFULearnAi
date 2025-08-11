import React, { useState, useRef } from 'react';
import { FiX, FiUpload, FiFile, FiTrash2 } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';
import { useUploadProgress } from '../../shared/hooks/useUploadProgress';
import UploadProgressTracker from '../../shared/ui/UploadProgressTracker';
import type { Collection } from '../../shared/types';

interface UploadDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
  onUploadComplete: () => void;
}

interface FileWithStatus {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const UploadDocumentsModal: React.FC<UploadDocumentsModalProps> = ({ 
  isOpen, 
  onClose, 
  collection, 
  onUploadComplete 
}) => {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useUIStore();
  const { addUpload, isUploading: isAnyUploading } = useUploadProgress();

  // Helper function to create safe FormData
  const createFormData = (file: File, collectionName: string, useQueue: boolean) => {
    const formData = new FormData();
    
    // Ensure we're appending actual File object
    if (!(file instanceof File)) {
      throw new Error('Invalid file object provided');
    }
    
    formData.append('file', file);
    formData.append('modelId', 'amazon.titan-embed-text-v1');
    formData.append('collectionName', collectionName);
    
    if (useQueue) {
      formData.append('useQueue', 'true');
    }
    
    return formData;
  };

  if (!isOpen) return null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const newFiles: FileWithStatus[] = selectedFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: 'pending' as const,
      progress: 0
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (!collection || files.length === 0) return;

    setIsUploading(true);
    
    // ตรวจสอบขนาดไฟล์เพื่อเลือกใช้ queue หรือ direct upload
    const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
    
    const uploadPromises = files.map(async (fileWithStatus, index) => {
      try {
        setFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, status: 'uploading' as const, progress: 0 } : f
        ));

        const { file } = fileWithStatus;
        
        // สำหรับไฟล์ขนาดใหญ่ ให้ใช้ queue
        const useQueue = file.size > LARGE_FILE_THRESHOLD;
        
        // Create FormData using helper function
        const formData = createFormData(file, collection.name, useQueue);
        
        // Validate FormData before sending
        const fileEntry = formData.get('file');
        if (!(fileEntry instanceof File)) {
          throw new Error(`Invalid file object: ${typeof fileEntry}`);
        }
        
        console.log('📁 Uploading file:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          collectionName: collection.name,
          useQueue: useQueue,
          fileInstance: file instanceof File,
          formDataFileInstance: fileEntry instanceof File,
          formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
            key,
            value: value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value
          }))
        });

        const response = await api.post('/training/upload', formData, {
          headers: {
            // Don't set Content-Type - let browser set it with proper boundary
          },
          onUploadProgress: (progressEvent) => {
            // สำหรับการ upload ไฟล์เท่านั้น (ไม่ใช่ processing)
            const uploadProgress = progressEvent.total 
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            
            setFiles(prev => prev.map((f, i) => 
              i === index ? { ...f, progress: Math.min(uploadProgress, 90) } : f
            ));
          }
        });

        const responseData = (response as any).data;

        if (responseData.queued) {
          // ไฟล์ถูกส่งไป queue แล้ว
          console.log(`📋 File ${file.name} queued with job ID: ${responseData.jobId}`);
          
          // เพิ่มเข้า upload progress tracker
          addUpload(responseData.jobId, file.name);
          
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
          // ไฟล์ประมวลผลเสร็จสิ้นแล้ว
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
        console.error(`Error uploading ${file.name}:`, error);
        
        let errorMessage = 'Upload failed';
        if (error?.response?.data?.error) {
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
          message: `Failed to upload ${file.name}: ${errorMessage}`
        });
        
        throw error;
      }
    });

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
          message: `Successfully uploaded ${files.length} document(s) to ${collection.name}`
        });
      }
      
      onUploadComplete();
      onClose();
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

  const getStatusIcon = (status: FileWithStatus['status']) => {
    switch (status) {
      case 'pending':
        return <FiFile className="h-4 w-4 text-muted" />;
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
      case 'success':
        return <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
          <div className="h-2 w-2 bg-primary rounded-full" />
        </div>;
      case 'error':
        return <div className="h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
          <div className="h-2 w-2 bg-primary rounded-full" />
        </div>;
    }
  };



  return (
    <div className="modal-overlay flex items-center justify-center z-50">
      <div className="modal-content w-full max-w-2xl bg-primary p-6 rounded-xl relative shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button className="absolute top-4 right-4 btn-ghost p-1" onClick={onClose}>
          <FiX className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-semibold text-primary mb-1">Upload Documents</h2>
        <p className="text-secondary mb-6">
          Upload documents to {collection?.name || 'selected collection'}
        </p>

        {/* File Upload Area */}
        <div className="mb-6">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <FiUpload className="h-12 w-12 text-muted mx-auto mb-4" />
            <p className="text-lg font-medium text-primary mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-muted">
              Supports PDF, DOCX, XLSX, CSV, TXT files (max 50MB each)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-primary mb-3">Selected Files</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((fileWithStatus, index) => (
                <div
                  key={fileWithStatus.id}
                  className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getStatusIcon(fileWithStatus.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {fileWithStatus.file.name}
                      </p>
                      <p className="text-xs text-muted">
                        {fileWithStatus.file.size ? `${(fileWithStatus.file.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                      </p>
                      {fileWithStatus.error && (
                        <p className="text-xs text-red-600">{fileWithStatus.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {fileWithStatus.status === 'uploading' && (
                      <div className="w-16 bg-secondary rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${fileWithStatus.progress}%` }}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      className="btn-ghost p-1 text-red-600 hover:text-red-700"
                      disabled={fileWithStatus.status === 'uploading'}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress Tracker */}
        {isAnyUploading && (
          <div className="mb-6">
            <UploadProgressTracker className="border-0 shadow-none bg-transparent" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={uploadFiles}
            disabled={files.length === 0 || isUploading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={onClose}
            className="btn-ghost"
            disabled={isUploading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadDocumentsModal; 