import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import RoleGuard from '@/components/guards/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { Collection } from '@/types/collection';
import toast from 'react-hot-toast';

interface DocumentInfo {
  filename: string;
  uploadedBy: string;
  timestamp: string;
  ids: string[];
}

interface ChunkPreview {
  id: string;
  text: string;
}

const PAGE_SIZE = 10;

export default function CollectionDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [collection, setCollection] = useState<Collection | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentInfo | null>(null);
  const [previewChunks, setPreviewChunks] = useState<ChunkPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all collections to find this one
      const colRes = await fetch('/api/collections', { headers: { Authorization: `Bearer ${token}` } });
      if (!colRes.ok) throw new Error('Failed to fetch collection');
      const allCols: Collection[] = await colRes.json();
      const col = allCols.find((c) => c.id === id);
      if (!col) throw new Error('Collection not found');
      setCollection(col);
      // Fetch documents for this collection
      const docsRes = await fetch(`/api/documents?collectionName=${encodeURIComponent(col.name)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!docsRes.ok) throw new Error('Failed to fetch documents');
      setDocuments(await docsRes.json());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && id) fetchData();
    // eslint-disable-next-line
  }, [token, id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);
    try {
      if (!fileInputRef.current?.files?.[0] || !collection) {
        setUploadError('Please select a file');
        setUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append('file', fileInputRef.current.files[0]);
      formData.append('collectionName', collection.name);
      // modelId is required by backend, but we don't have it here; skip for now
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.message || 'Failed to upload document');
      }
      fileInputRef.current.value = '';
      toast.success('Upload successful!');
      fetchData();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this document?')) return;
    setDeleteId(docId);
    setDeleteError(null);
    try {
      if (!collection) throw new Error('Collection not found');
      const res = await fetch(`/api/documents/${docId}?collectionName=${encodeURIComponent(collection.name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.message || 'Failed to delete document');
      }
      toast.success('Document deleted');
      fetchData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete document');
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeleteId(null);
    }
  };

  const handlePreview = async (doc: DocumentInfo) => {
    setPreviewDoc(doc);
    setPreviewChunks([]);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      if (!collection) throw new Error('Collection not found');
      // Assume backend endpoint: /api/documents/chunks?collectionName=...&id=...
      const res = await fetch(`/api/documents/chunks?collectionName=${encodeURIComponent(collection.name)}&id=${doc.ids[0]}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch document chunks');
      const data = await res.json();
      setPreviewChunks(data.chunks || []);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to fetch document chunks');
      toast.error(err.message || 'Failed to fetch document chunks');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (doc: DocumentInfo) => {
    if (!collection) return;
    try {
      const res = await fetch(`/api/documents/download/${doc.ids[0]}?collectionName=${encodeURIComponent(collection.name)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download not supported or failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (err) {
      toast.error('Download not supported or failed');
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewChunks([]);
    setPreviewLoading(false);
    setPreviewError(null);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE) || 1;
  const paginatedDocuments = filteredDocuments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <RoleGuard allowed={['Students', 'Staffs', 'Admin', 'SuperAdmin']}>
      <div className="max-w-3xl mx-auto py-10">
        <button className="mb-4 text-blue-600" onClick={() => router.back()}>&larr; Back</button>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {collection && !loading && !error && (
          <>
            <h1 className="text-2xl font-bold mb-2">Collection: {collection.name}</h1>
            <div className="mb-4 text-gray-600">Permission: {collection.permission}</div>
            <div className="mb-4 text-gray-600">Created By: {collection.createdBy}</div>
            <div className="mb-4 text-gray-600">Created At: {collection.createdAt ? new Date(collection.createdAt).toLocaleString() : '-'}</div>
            <form className="mb-8 p-4 bg-gray-50 rounded border" onSubmit={handleUpload}>
              <label className="block text-sm font-medium mb-1">Upload Document</label>
              <input type="file" ref={fileInputRef} className="mb-2" disabled={uploading} />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              {uploadError && <div className="text-red-600 mt-2">{uploadError}</div>}
            </form>
            <input
              type="text"
              placeholder="Search filename..."
              className="mb-4 px-3 py-2 border rounded w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <h2 className="text-lg font-bold mb-2">Documents</h2>
            {deleteError && <div className="text-red-600 mb-2">{deleteError}</div>}
            <table className="w-full border mt-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 text-left">Filename</th>
                  <th className="py-2 px-4 text-left">Uploaded By</th>
                  <th className="py-2 px-4 text-left">Timestamp</th>
                  <th className="py-2 px-4 text-left">Chunks</th>
                  <th className="py-2 px-4 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDocuments.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4">No documents</td></tr>
                ) : paginatedDocuments.map((doc) => (
                  <tr key={doc.ids[0]} className="border-t">
                    <td className="py-2 px-4">{doc.filename}</td>
                    <td className="py-2 px-4">{doc.uploadedBy}</td>
                    <td className="py-2 px-4">{new Date(doc.timestamp).toLocaleString()}</td>
                    <td className="py-2 px-4">{doc.ids.length}</td>
                    <td className="py-2 px-4 flex gap-2">
                      <button
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                        onClick={() => handlePreview(doc)}
                        disabled={previewLoading}
                      >
                        Preview
                      </button>
                      <button
                        className="bg-blue-500 text-white px-3 py-1 rounded text-xs"
                        onClick={() => handleDownload(doc)}
                      >
                        Download
                      </button>
                      <button
                        className="bg-red-500 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                        onClick={() => handleDelete(doc.ids[0])}
                        disabled={!!deleteId}
                      >
                        {deleteId === doc.ids[0] ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination Controls */}
            <div className="flex justify-between items-center mt-4">
              <button
                className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Prev
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
            {/* Preview Modal */}
            {previewDoc && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg relative max-h-[80vh] overflow-y-auto">
                  <button
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                    onClick={closePreview}
                  >
                    ×
                  </button>
                  <h3 className="text-lg font-bold mb-2">Preview: {previewDoc.filename}</h3>
                  {previewLoading && <div>Loading chunks...</div>}
                  {previewError && <div className="text-red-600 mb-2">{previewError}</div>}
                  {!previewLoading && !previewError && previewChunks.length > 0 && (
                    <ul className="list-decimal ml-6">
                      {previewChunks.map((chunk) => (
                        <li key={chunk.id} className="mb-2 p-2 bg-gray-50 rounded border">
                          <pre className="whitespace-pre-wrap text-sm">{chunk.text}</pre>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!previewLoading && !previewError && previewChunks.length === 0 && (
                    <div className="text-gray-500">No chunk data available.</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
} 