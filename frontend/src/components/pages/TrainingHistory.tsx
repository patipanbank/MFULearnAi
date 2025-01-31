import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';
import { FaTrash } from 'react-icons/fa';

interface TrainingDocument {
  ids: string[];
  documents: string[];
  metadatas: {
    filename: string;
    uploadedBy: string;
    timestamp: string;
    modelId: string;
    collectionName: string;
  }[];
}

const TrainingHistory: React.FC = () => {
  const [documents, setDocuments] = useState<TrainingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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
      const combinedDocuments = {
        ids: allDocuments.flatMap(doc => doc.ids),
        documents: allDocuments.flatMap(doc => doc.documents),
        metadatas: allDocuments.flatMap(doc => doc.metadatas)
      };

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

  const handleDelete = async (id: string, collectionName: string) => {
    if (!window.confirm('Are you sure you want to delete this data?')) {
      return;
    }

    setIsDeleting(id);
    try {
      console.log(`Deleting document ${id} from collection ${collectionName}`);
      const response = await fetch(
        `${config.apiUrl}/api/training/documents/${id}?collectionName=${encodeURIComponent(collectionName)}`,
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

  const handleDeleteAll = async (collectionName: string) => {
    if (!window.confirm('Are you sure you want to delete all data in this collection?')) {
      return;
    }

    setIsDeletingAll(true);
    try {
      const response = await fetch(
        `${config.apiUrl}/api/training/documents/all/${encodeURIComponent(collectionName)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete all documents');
      }

      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting all documents:', error);
      alert('Failed to delete all documents');
    } finally {
      setIsDeletingAll(false);
    }
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
      <div className="text-red-500 dark:text-red-400 text-center p-4">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Training History</h1>
      <div className="flex justify-between items-center mb-6">
        <div className="space-x-2">
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Incomplete Data
          </button>
          {documents && documents.metadatas && documents.metadatas.length > 0 && (
            <button
              onClick={() => handleDeleteAll(documents.metadatas[0].collectionName)}
              disabled={isDeletingAll}
              className={`px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 ${
                isDeletingAll ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isDeletingAll ? 'Deleting All...' : 'Delete Training History All'}
            </button>
          )}
        </div>
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
            {documents?.metadatas.map((metadata, index) => (
              <tr key={documents.ids[index]} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{metadata.filename}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {metadata.modelId}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    {metadata.collectionName}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{metadata.uploadedBy}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(metadata.timestamp).toLocaleString('th-TH')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleDelete(documents.ids[index], metadata.collectionName)}
                    disabled={isDeleting === documents.ids[index]}
                    className={`text-red-600 hover:text-red-800 ${
                      isDeleting === documents.ids[index] ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isDeleting === documents.ids[index] ? (
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

        {documents?.metadatas.length === 0 && (
          <div className="text-gray-600 dark:text-gray-300 text-center py-4">
            No training data found
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingHistory; 