import React, { useEffect, useState } from 'react';
import { FiUpload, FiX, FiSearch, FiEye, FiTrash2, FiFile, FiFileText, FiImage, FiGrid } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';
import { useUploadProgress } from '../../shared/hooks/useUploadProgress';
import UploadProgressTracker from '../../shared/ui/UploadProgressTracker';
import type { Collection } from '../../shared/types';

interface CollectionDocument {
  id: string;
  document?: string;
  metadata?: {
    source?: string;
    source_type?: string;
    uploadedBy?: string;
    modelId?: string;
    collectionName?: string;
  };
}

interface CollectionDetailModalProps {
  collection: Collection | null;
  isOpen: boolean;
  onClose: () => void;
}

interface FileWithStatus {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const CollectionDetailModal: React.FC<CollectionDetailModalProps> = ({ collection, isOpen, onClose }) => {
  const [docs, setDocs] = useState<CollectionDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<CollectionDocument | null>(null);

  const [previewContent, setPreviewContent] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { addToast } = useUIStore();
  const { addUpload, isUploading: isAnyUploading } = useUploadProgress();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);



  // Fetch docs when modal opens
  useEffect(() => {
    if (isOpen && collection) {
      fetchDocs();
    }
  }, [isOpen, collection]);

  const fetchDocs = async () => {
    if (!collection) return;
    setIsLoadingDocs(true);
    try {
      const response = await api.get<CollectionDocument[]>(`/collections/${collection._id}/documents`);
      setDocs(response || []);
    } catch (err) {
      console.error('Failed to fetch documents', err);
      setDocs([]);
      addToast({
        type: 'error',
        title: 'Failed to load documents',
        message: 'Unable to load documents from this collection.'
      });
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        addToast({
          type: 'warning',
          title: 'File Too Large',
          message: `${file.name} is too large. Maximum file size is 50MB.`
        });
        return false;
      }
      return true;
    });

    const newFiles: FileWithStatus[] = validFiles.map(file => {
      console.log('🔍 Creating FileWithStatus:', {
        originalFile: file,
        fileInstanceOf: file instanceof File,
        fileName: file.name,
        fileSize: file.size,
        fileConstructor: file.constructor.name
      });
      
      return {
        file,
        id: `${Date.now()}-${Math.random()}`,
        status: 'pending' as const,
        progress: 0
      };
    });
    
    console.log('🔍 New files created:', newFiles.map(f => ({
      id: f.id,
      fileType: typeof f.file,
      fileInstanceOf: f.file instanceof File,
      fileName: f.file?.name
    })));
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const allowedTypes = ['.pdf', '.docx', '.xlsx', '.csv', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      // Check file type
      if (!allowedTypes.includes(fileExtension)) {
        return false;
      }
      
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        addToast({
          type: 'warning',
          title: 'File Too Large',
          message: `${file.name} is too large. Maximum file size is 50MB.`
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length !== droppedFiles.length) {
      const invalidCount = droppedFiles.length - validFiles.length;
      addToast({
        type: 'warning',
        title: 'Invalid Files',
        message: `${invalidCount} file(s) were skipped. Only PDF, DOCX, XLSX, CSV, and TXT files under 50MB are supported.`
      });
    }

    const newFiles: FileWithStatus[] = validFiles.map(file => ({
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

  const handleUpload = async () => {
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
        
        // Debug: Check file object integrity
        console.log('🔍 File object debug:', {
          fileWithStatusType: typeof fileWithStatus,
          fileType: typeof file,
          fileInstanceOf: file instanceof File,
          fileName: file?.name,
          fileSize: file?.size,
          fileConstructor: file?.constructor?.name,
          hasFileMethod: typeof file?.stream === 'function'
        });
        
        // สำหรับไฟล์ขนาดใหญ่ ให้ใช้ queue
        const useQueue = file.size > LARGE_FILE_THRESHOLD;
        
        // Create FormData manually instead of using helper
        const formData = new FormData();
        
        // Direct validation before append
        if (!(file instanceof File)) {
          throw new Error(`Invalid file object before append: ${typeof file}, constructor: ${(file as any)?.constructor?.name}`);
        }
        
        formData.append('file', file);
        formData.append('modelId', 'amazon.titan-embed-text-v1');
        formData.append('collectionName', collection.name);
        
        if (useQueue) {
          formData.append('useQueue', 'true');
        }
        
        // Validate FormData after creation
        const fileEntry = formData.get('file');
        console.log('🔍 FormData validation:', {
          fileEntryType: typeof fileEntry,
          fileEntryInstanceOf: fileEntry instanceof File,
          fileEntryName: fileEntry instanceof File ? fileEntry.name : 'not a file',
          formDataSize: Array.from(formData.entries()).length
        });
        
        if (!(fileEntry instanceof File)) {
          throw new Error(`Invalid file object in FormData: ${typeof fileEntry}`);
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
          console.log(`📋 File ${fileWithStatus.file.name} queued with job ID: ${responseData.jobId}`);
          
          // เพิ่มเข้า upload progress tracker
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
        console.error(`Error uploading ${fileWithStatus.file.name}:`, error);
        
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
          message: `Failed to upload ${fileWithStatus.file.name}: ${errorMessage}`
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
      
      fetchDocs();
      setTimeout(() => {
        setFiles([]);
      }, 2000); // Clear files after 2 seconds
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

  // Group documents by source (filename)
  const groupedDocs = React.useMemo(() => {
    const groups: { [source: string]: CollectionDocument[] } = {};
    docs.forEach((doc) => {
      const source = doc.metadata?.source || 'Unknown Document';
      if (!groups[source]) groups[source] = [];
      groups[source].push(doc);
    });
    return groups;
  }, [docs]);

  // For search
  const groupedFilteredDocs = React.useMemo(() => {
    if (!searchQuery.trim()) return groupedDocs;
    const filtered: { [source: string]: CollectionDocument[] } = {};
    Object.entries(groupedDocs).forEach(([source, docs]) => {
      if (
        source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docs.some((doc) => doc.document?.toLowerCase().includes(searchQuery.toLowerCase()))
      ) {
        filtered[source] = docs;
      }
    });
    return filtered;
  }, [groupedDocs, searchQuery]);

  const handlePreview = async (doc: CollectionDocument) => {
    setSelectedDoc(doc);
    setIsLoadingPreview(true);
    try {
      // Find all docs with the same source
      const allChunks = docs.filter((d) => d.metadata?.source === doc.metadata?.source);
      const content = allChunks.map((d) => d.document || '').join('\n---\n');
      setPreviewContent(content || 'No content available');
    } catch (error) {
      console.error('Failed to load preview:', error);
      setPreviewContent('Failed to load document preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Update handleDeleteDocument to accept array
  const handleDeleteDocument = async (docIds: string[] | string) => {
    if (!collection) return;
    const ids = Array.isArray(docIds) ? docIds : [docIds];
    try {
      await api.delete(`/collections/${collection._id}/documents`, {
        data: { documentIds: ids }
      });
      addToast({
        type: 'success',
        title: 'Document Deleted',
        message: 'Document has been removed from the collection.'
      });
      fetchDocs();
    } catch (error) {
      console.error('Failed to delete document:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Unable to delete document.'
      });
    }
  };

  const getFileIcon = (sourceType?: string) => {
    switch (sourceType) {
      case 'pdf':
        return <FiFile className="h-5 w-5 text-red-500" />;
      case 'docx':
      case 'doc':
        return <FiFileText className="h-5 w-5 text-blue-500" />;
      case 'xlsx':
      case 'xls':
        return <FiGrid className="h-5 w-5 text-green-500" />;
      case 'image':
        return <FiImage className="h-5 w-5 text-purple-500" />;
      default:
        return <FiFile className="h-5 w-5 text-muted" />;
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (!isOpen || !collection) return null;

  return (
    <div className="modal-overlay flex items-center justify-center z-40">
      <div className="modal-content w-full max-w-6xl bg-primary p-6 rounded-xl relative shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Close */}
        <button className="absolute top-4 right-4 btn-ghost p-1" onClick={onClose}>
          <FiX className="h-5 w-5" />
        </button>

        {/* Header */}
        <h2 className="text-2xl font-semibold text-primary mb-1 flex items-center">
          {collection.name}
        </h2>
        <p className="text-secondary mb-6">Manage documents and settings for this collection</p>

        {/* Upload Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Upload Documents</h3>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-border hover:border-blue-500'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FiUpload className={`h-12 w-12 mx-auto mb-4 ${
              isDragging ? 'text-blue-500' : 'text-muted'
            }`} />
            <p className={`text-lg font-medium mb-2 ${
              isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-primary'
            }`}>
              {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
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



        {/* Search Section */}
        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
            <input
              type="text"
              placeholder="Search documents..."
              className="input pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Documents List */}
          <div className="w-1/2 pr-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Documents ({Object.keys(groupedFilteredDocs).length})</h3>
            </div>

            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-secondary">Loading documents...</span>
              </div>
            ) : Object.keys(groupedFilteredDocs).length === 0 ? (
              <div className="text-center py-12 text-muted text-sm">
                {searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(groupedFilteredDocs).map(([source, docs]) => (
                  <div
                    key={source}
                    className={`p-4 rounded-lg card card-hover cursor-pointer transition-colors ${
                      selectedDoc && selectedDoc.metadata?.source === source ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:ring-blue-400' : ''
                    }`}
                    onClick={() => handlePreview(docs[0])}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        {getFileIcon(docs[0].metadata?.source_type)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-primary truncate">
                            {source}
                          </h4>
                          <p className="text-sm text-muted mt-1">
                            {docs[0].document ? truncateText(docs[0].document, 80) : 'No content preview'}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-muted">
                            <span>Type: {docs[0].metadata?.source_type || 'unknown'}</span>
                            <span>By: {docs[0].metadata?.uploadedBy || 'unknown'}</span>
                            <span>Chunks: {docs.length}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(docs[0]);
                          }}
                          className="btn-ghost p-1"
                          title="Preview"
                        >
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Delete all chunks for this file
                            await handleDeleteDocument(docs.map((d) => d.id));
                          }}
                          className="btn-ghost p-1 text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Preview */}
          <div className="w-1/2 pl-4 border-l border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Document Preview</h3>
            </div>
            
            {!selectedDoc ? (
              <div className="text-center py-12 text-muted">
                <FiFile className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a document to preview its content</p>
              </div>
            ) : (
              <div className="bg-secondary rounded-lg p-4 h-full overflow-y-auto">
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-secondary">Loading preview...</span>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 pb-4 border-b border-border">
                      <h4 className="font-semibold text-primary mb-2">
                        {selectedDoc.metadata?.source || 'Document Preview'}
                      </h4>
                      <div className="text-sm text-muted space-y-1">
                        <p>Type: {selectedDoc.metadata?.source_type || 'unknown'}</p>
                        <p>Uploaded by: {selectedDoc.metadata?.uploadedBy || 'unknown'}</p>
                        <p>Model: {selectedDoc.metadata?.modelId || 'unknown'}</p>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-primary bg-primary p-4 rounded border">
                        {previewContent}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {files.length > 0 && (
          <div className="flex space-x-3 mt-6 pt-4 border-t border-border">
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || isUploading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setFiles([])}
              className="btn-ghost"
              disabled={isUploading}
            >
              Clear Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionDetailModal; 