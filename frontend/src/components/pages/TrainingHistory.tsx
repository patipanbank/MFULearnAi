import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';

interface TrainingDocument {
  ids: string[];
  documents: string[];
  metadatas: {
    filename: string;
    uploadedBy: string;
    timestamp: string;
  }[];
}

const TrainingHistory: React.FC = () => {
  const [documents, setDocuments] = useState<TrainingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/api/training/documents`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }

        const data = await response.json();
        setDocuments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

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
      <h1 className="text-2xl font-bold mb-6">ประวัติการเทรนข้อมูล</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อไฟล์</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อัพโหลดโดย</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่อัพโหลด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {documents?.metadatas.map((metadata, index) => (
              <tr key={documents.ids[index]} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{metadata.filename}</td>
                <td className="px-6 py-4 whitespace-nowrap">{metadata.uploadedBy}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(metadata.timestamp).toLocaleString('th-TH')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrainingHistory; 