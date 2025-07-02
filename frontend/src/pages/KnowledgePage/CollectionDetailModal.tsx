import React, { useEffect, useState } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';
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
  filename: string;
  uploadedAt: string;
}

interface CollectionDetailModalProps {
  collection: Collection | null;
  isOpen: boolean;
  onClose: () => void;
}

const CollectionDetailModal: React.FC<CollectionDetailModalProps> = ({ collection, isOpen, onClose }) => {
  const [docs, setDocs] = useState<CollectionDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useUIStore();

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
      const loaded = await api.get<CollectionDocument[]>(`/collections/${collection.id}/documents`);
      setDocs(loaded);
    } catch (err) {
      console.error('Failed to fetch documents', err);
      setDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleUpload = async () => {
    if (!collection || !selectedFile) return;
    if (selectedFile.size > 1024 * 1024) {
      addToast({
        type: 'warning',
        title: 'File Too Large',
        message: 'Max file size is 1MB.'
      });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      await api.post(`/collections/${collection.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSelectedFile(null);
      addToast({
        type: 'success',
        title: 'Upload Success',
        message: `${selectedFile.name} uploaded.`
      });
      fetchDocs();
    } catch (err) {
      console.error('Upload failed', err);
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: 'Unable to upload document.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen || !collection) return null;

  return (
    <div className="modal-overlay flex items-center justify-center z-40">
      <div className="modal-content w-full max-w-3xl bg-primary p-6 rounded-xl relative shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
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
        <div className="border-2 border-dashed border-border rounded-lg p-6 mb-8">
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
          <p className="text-xs text-secondary mt-2">Supported formats: PDF, TXT, DOC, DOCX, XLS, XLSX, CSV, JSON, XML (Max 1MB)</p>
        </div>

        {/* Documents Section */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-primary">Documents in Collection</h3>
            <span className="text-sm text-secondary">{docs.length} documents</span>
          </div>

          {isLoadingDocs ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-secondary">Loading documents...</span>
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm">No documents uploaded yet</div>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li key={doc.id} className="p-3 rounded-lg card card-hover flex items-center justify-between">
                  <span className="truncate mr-4">{doc.filename}</span>
                  <span className="text-xs text-secondary">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionDetailModal; 