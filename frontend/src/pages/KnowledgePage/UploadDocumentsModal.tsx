import React, { useRef } from 'react';
import { FiX, FiUpload, FiFile, FiTrash2 } from 'react-icons/fi';
import { useUploadProgress } from '../../shared/hooks/useUploadProgress';
import { useDocumentUpload, type FileWithStatus } from '../../shared/hooks/useDocumentUpload';
import UploadProgressTracker from '../../shared/ui/UploadProgressTracker';
import type { Collection } from '../../shared/types';

interface UploadDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
  onUploadComplete: () => void;
}


const UploadDocumentsModal: React.FC<UploadDocumentsModalProps> = ({ 
  isOpen, 
  onClose, 
  collection, 
  onUploadComplete 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isUploading: isAnyUploading } = useUploadProgress();
  
  const {
    files,
    isUploading,
    addFiles,
    removeFile,
    uploadFiles,
    clearFiles
  } = useDocumentUpload({
    onUploadComplete: () => {
      onUploadComplete();
      onClose();
      clearFiles();
    }
  });



  if (!isOpen) return null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    addFiles(selectedFiles);
  };


  const handleUploadFiles = async () => {
    if (!collection || files.length === 0) return;
    await uploadFiles(collection.name);
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
              Supports PDF, DOCX, XLSX, CSV, TXT files (max 100MB each)
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
            onClick={handleUploadFiles}
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