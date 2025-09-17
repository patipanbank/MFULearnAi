import { useState, useCallback } from 'react';
import { api } from '../../../shared/lib/api';
import { useUIStore } from '../../../shared/stores';
import type { UseFileUploadResult } from '../types';

export const useFileUpload = (): UseFileUploadResult => {
  const addToast = useUIStore((state) => state.addToast);
  const [files, setFiles] = useState<Array<{ url: string; name: string; type: string; size: number }>>([]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 File upload triggered');

    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      console.log('⚠️ No files selected');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];

      if (file.size > maxSize) {
        addToast({
          type: 'error',
          title: 'File Too Large',
          message: `${file.name} is too large. Maximum size is 10MB.`
        });
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        addToast({
          type: 'error',
          title: 'Invalid File Type',
          message: `${file.name} is not supported. Only PDF, DOCX, and TXT files are allowed.`
        });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<{ url: string; filename: string }>('/upload/document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('📁 Upload response:', response);
        setFiles(prev => [...prev, {
          url: response.url,
          name: response.filename || file.name,
          type: file.type,
          size: file.size
        }]);

        addToast({
          type: 'success',
          title: 'File Uploaded',
          message: `${file.name} uploaded successfully`
        });
      } catch (error) {
        console.error('📁 Upload error:', error);
        addToast({
          type: 'error',
          title: 'Upload Failed',
          message: `Failed to upload ${file.name}`
        });
      }
    }

    // Clear input
    event.target.value = '';
  }, [addToast]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    files,
    handleFileUpload,
    handleRemoveFile,
    setFiles
  };
};