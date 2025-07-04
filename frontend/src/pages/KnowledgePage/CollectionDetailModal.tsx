import React, { useEffect, useState } from 'react';
import { FiUpload, FiX, FiSearch, FiEye, FiTrash2, FiFile, FiFileText, FiImage, FiGrid } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';

interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
}

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

const CollectionDetailModal: React.FC<CollectionDetailModalProps> = ({ collection, isOpen, onClose }) => {
  const [docs, setDocs] = useState<CollectionDocument[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<CollectionDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<CollectionDocument | null>(null);

  const [previewContent, setPreviewContent] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { addToast } = useUIStore();

  // Fetch docs when modal opens
  useEffect(() => {
    if (isOpen && collection) {
      fetchDocs();
    }
  }, [isOpen, collection]);

  // Filter documents based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDocs(docs);
    } else {
      const filtered = docs.filter(doc => 
        doc.metadata?.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.document?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDocs(filtered);
    }
  }, [searchQuery, docs]);

  const fetchDocs = async () => {
    if (!collection) return;
    setIsLoadingDocs(true);
    try {
      const response = await api.get<CollectionDocument[]>(`/collections/${collection.id}/documents`);
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

  const handleUpload = async () => {
    if (!collection || !selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      addToast({
        type: 'warning',
        title: 'File Too Large',
        message: 'Max file size is 10MB.'
      });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('modelId', 'amazon.titan-embed-text-v1');  // Use Titan embedding model
      formData.append('collectionName', collection.name);
      
      await api.post('/training/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      setSelectedFile(null);
      addToast({
        type: 'success',
        title: 'Upload Success',
        message: `${selectedFile.name} uploaded and processed successfully.`
      });
      fetchDocs();
    } catch (err) {
      console.error('Upload failed', err);
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: 'Unable to upload and process document.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = async (doc: CollectionDocument) => {
    setSelectedDoc(doc);
    setIsLoadingPreview(true);
    
    try {
      // For now, we'll show the document text directly
      // In a real implementation, you might want to fetch the full document content
      const content = doc.document || 'No content available';
      setPreviewContent(content);
    } catch (error) {
      console.error('Failed to load preview:', error);
      setPreviewContent('Failed to load document preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!collection) return;
    
    try {
      await api.delete(`/collections/${collection.id}/documents`, {
        data: [docId]
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
        return <FiFile className="h-5 w-5 text-gray-500" />;
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
        <div className="border-2 border-dashed border-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Upload Document</h3>
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.json,.xml"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="input flex-1 mb-4 md:mb-0"
            />
            <button
              onClick={handleUpload}
              className="btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
              disabled={isUploading || !selectedFile}
            >
              <FiUpload className="h-4 w-4" />
              <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
            </button>
          </div>
          <p className="text-xs text-secondary mt-2">Supported formats: PDF, TXT, DOC, DOCX, XLS, XLSX, CSV, JSON, XML (Max 10MB)</p>
        </div>

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
              <h3 className="text-lg font-semibold text-primary">Documents ({filteredDocs.length})</h3>
            </div>

            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-secondary">Loading documents...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-muted text-sm">
                {searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-lg card card-hover cursor-pointer transition-colors ${
                      selectedDoc?.id === doc.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => handlePreview(doc)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        {getFileIcon(doc.metadata?.source_type)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-primary truncate">
                            {doc.metadata?.source || 'Unknown Document'}
                          </h4>
                          <p className="text-sm text-muted mt-1">
                            {doc.document ? truncateText(doc.document, 80) : 'No content preview'}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-muted">
                            <span>Type: {doc.metadata?.source_type || 'unknown'}</span>
                            <span>By: {doc.metadata?.uploadedBy || 'unknown'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(doc);
                          }}
                          className="btn-ghost p-1"
                          title="Preview"
                        >
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id);
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
      </div>
    </div>
  );
};

export default CollectionDetailModal; 