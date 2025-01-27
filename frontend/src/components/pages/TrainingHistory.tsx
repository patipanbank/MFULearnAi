import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';
import { FaTrash } from 'react-icons/fa';

interface Document {
  id: string;
  document: string;
  metadata: {
    filename?: string;
    fileName?: string;
    url?: string;
    modelId: string;
    collectionName: string;
    uploadedBy: string;
    timestamp: string;
  };
}

const TrainingHistory: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      // เพิ่ม query parameter collectionName
      const collections = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const collectionList = await collections.json();
      
      // ดึงข้อมูลจากทุก collection
      const allDocuments = await Promise.all(
        collectionList.map(async (collectionName: string) => {
          const response = await fetch(
            `${config.apiUrl}/api/training/documents?collectionName=${collectionName}`,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              }
            }
          );
          if (!response.ok) {
            throw new Error('Failed to fetch documents');
          }
          return response.json();
        })
      );
      // รวมข้อมูลจากทุก collection
      const combinedDocuments = allDocuments.flatMap(doc => doc.documents.map((document: string) => ({
        id: doc.ids[doc.documents.indexOf(document)],
        document: document,
        metadata: doc.metadatas[doc.documents.indexOf(document)]
      })));

      setDocuments(combinedDocuments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this data?')) {
      return;
    }

    setIsDeleting(id);
    try {
      console.log(`Deleting document ${id}`);
      const response = await fetch(
        `${config.apiUrl}/api/training/documents/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to delete document');
      }

      // รีเฟรชข้อมูลหลังจากลบสำเร็จ
      await fetchDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('Are you sure you want to delete data that does not have a model or collection?')) {
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/training/cleanup`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup documents');
      }

      // รีเฟรชข้อมูลหลังจากลบสำเร็จ
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during cleanup');
    }
  };

  const renderFileName = (doc: Document) => {
    const metadata = doc.metadata || {};
    if (metadata.filename) {
      return metadata.filename;
    } else if (metadata.fileName) {
      return metadata.fileName;
    } else if (metadata.url) {
      return metadata.url;
    }
    return 'Unknown source';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Training History</h1>
        <button
          onClick={handleCleanup}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Delete Incomplete Data
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upload Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{renderFileName(doc)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {doc.metadata?.modelId || ''}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    {doc.metadata?.collectionName || ''}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{doc.metadata?.uploadedBy || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(doc.metadata?.timestamp || '').toLocaleString('th-TH')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={isDeleting === doc.id}
                    className={`text-red-600 hover:text-red-800 ${
                      isDeleting === doc.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isDeleting === doc.id ? (
                      <span className="inline-block animate-spin">⌛</span>
                    ) : (
                      <FaTrash />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {documents.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No training data found
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingHistory; 