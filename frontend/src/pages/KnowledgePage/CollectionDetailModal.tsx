import React, { useEffect, useState } from 'react';
import { FiUpload, FiX, FiSearch, FiEye, FiTrash2, FiFile, FiFileText, FiImage, FiGrid } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';
import UploadDocumentsModal from './UploadDocumentsModal';
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

const CollectionDetailModal: React.FC<CollectionDetailModalProps> = ({ collection, isOpen, onClose }) => {
  const [docs, setDocs] = useState<CollectionDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<CollectionDocument | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { addToast } = useUIStore();

  useEffect(() => {
    if (collection && isOpen) {
      loadDocuments();
    }
  }, [collection, isOpen]);

  const loadDocuments = async () => {
    if (!collection) return;

    setIsLoadingDocs(true);
    try {
      console.log('📚 Loading documents for collection:', collection.name);
      const response = await api.get(`/collections/${collection.name}/documents`);
      
      const documents = (response as any).data?.documents || [];
      console.log(`📚 Loaded ${documents.length} documents`);
      setDocs(documents);
    } catch (error: any) {
      console.error('❌ Error loading documents:', error);
      addToast({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load documents from collection'
      });
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const previewDocument = async (doc: CollectionDocument) => {
    setSelectedDoc(doc);
    setIsLoadingPreview(true);
    setPreviewContent('');

    try {
      // For now, just show the document content if available
      if (doc.document) {
        setPreviewContent(doc.document);
      } else {
        setPreviewContent('No content available for preview');
      }
    } catch (error) {
      console.error('❌ Error loading preview:', error);
      setPreviewContent('Failed to load document preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const deleteDocument = async (doc: CollectionDocument) => {
    if (!collection) return;
    
    if (!confirm(`Are you sure you want to delete this document?`)) return;

    try {
      await api.delete(`/collections/${collection.name}/documents/${doc.id}`);
      addToast({
        type: 'success',
        title: 'Document Deleted',
        message: 'Document has been successfully deleted'
      });
      loadDocuments(); // Refresh the list
    } catch (error: any) {
      console.error('❌ Error deleting document:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete document'
      });
    }
  };

  const filteredDocs = docs.filter(doc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.document?.toLowerCase().includes(query) ||
      doc.metadata?.source?.toLowerCase().includes(query) ||
      doc.metadata?.source_type?.toLowerCase().includes(query)
    );
  });

  const getDocIcon = (doc: CollectionDocument) => {
    const sourceType = doc.metadata?.source_type?.toLowerCase() || '';
    const source = doc.metadata?.source?.toLowerCase() || '';
    
    if (sourceType.includes('image') || source.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return <FiImage className="h-4 w-4 text-blue-500" />;
    } else if (source.match(/\.(pdf|doc|docx|txt|csv|xlsx)$/i)) {
      return <FiFileText className="h-4 w-4 text-green-500" />;
    } else {
      return <FiFile className="h-4 w-4 text-muted" />;
    }
  };

  const formatSource = (source?: string) => {
    if (!source) return 'Unknown';
    return source.length > 50 ? `${source.substring(0, 50)}...` : source;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay flex items-center justify-center z-50">
        <div className="modal-content w-full max-w-7xl bg-primary p-6 rounded-xl relative shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-primary">Collection Details</h2>
              <p className="text-secondary">
                {collection?.name} • {docs.length} document{docs.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <FiUpload className="h-4 w-4" />
                <span>Upload Documents</span>
              </button>
              <button className="btn-ghost p-1" onClick={onClose}>
                <FiX className="h-5 w-5" />
              </button>
            </div>
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
              {isLoadingDocs ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-12">
                  <FiGrid className="h-12 w-12 text-muted mx-auto mb-4" />
                  <p className="text-muted">
                    {searchQuery ? 'No documents match your search' : 'No documents in this collection yet'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn-primary mt-4"
                    >
                      Upload Your First Document
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-blue-500 ${
                        selectedDoc?.id === doc.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'border-border bg-secondary'
                      }`}
                      onClick={() => previewDocument(doc)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {getDocIcon(doc)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">
                              {formatSource(doc.metadata?.source)}
                            </p>
                            <p className="text-xs text-muted">
                              {doc.metadata?.source_type || 'Unknown type'} • 
                              By {doc.metadata?.uploadedBy || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              previewDocument(doc);
                            }}
                            className="btn-ghost p-1 text-blue-600 hover:text-blue-700"
                            title="Preview"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDocument(doc);
                            }}
                            className="btn-ghost p-1 text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {doc.document && doc.document.length > 0 && (
                        <p className="text-xs text-muted mt-2 line-clamp-2">
                          {doc.document.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document Preview */}
            <div className="w-1/2 pl-4 border-l border-border">
              {selectedDoc ? (
                <div className="h-full flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-primary mb-2">Document Preview</h3>
                    <div className="flex items-center space-x-2 text-sm text-muted">
                      {getDocIcon(selectedDoc)}
                      <span>{formatSource(selectedDoc.metadata?.source)}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto bg-secondary rounded-lg p-4">
                    {isLoadingPreview ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-primary font-mono">
                        {previewContent}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <FiEye className="h-12 w-12 text-muted mx-auto mb-4" />
                    <p className="text-muted">Select a document to preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadDocumentsModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        collection={collection}
        onUploadComplete={() => {
          setShowUploadModal(false);
          loadDocuments(); // Refresh documents list
        }}
      />
    </>
  );
};

export default CollectionDetailModal;