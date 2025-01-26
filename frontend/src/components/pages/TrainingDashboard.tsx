import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';
import { FaTrash } from 'react-icons/fa';

const TrainingDashboard: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingCollections, setLoadingCollections] = useState(true);

  useEffect(() => {
    fetchModels();
    fetchCollections();
  }, []);

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      const response = await fetch(`${config.apiUrl}/api/training/models`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      setModels(data);
      if (data.length === 1) {
        setSelectedModel(data[0]);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchCollections = async () => {
    try {
      setLoadingCollections(true);
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      const data = await response.json();
      setCollections(data);
      if (data.length === 1) {
        setSelectedCollection(data[0]);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const createNewCollection = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collectionName: newCollectionName })
      });
      if (response.ok) {
        await fetchCollections();
        setNewCollectionName('');
        setShowNewCollectionForm(false);
      }
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedModel || !selectedCollection) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('modelId', selectedModel);
    formData.append('collectionName', selectedCollection);

    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      alert('อัพโหลดไฟล์สำเร็จ');
      setFile(null);
    } catch (error) {
      console.error('Error:', error);
      alert('อัพโหลดไฟล์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCollection = async (collectionName: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบ Collection "${collectionName}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${config.apiUrl}/api/training/collections/${encodeURIComponent(collectionName)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete collection');
      }

      // รีเฟรช collections หลังจากลบสำเร็จ
      fetchCollections();
    } catch (error) {
      console.error('Error:', error);
      alert('ไม่สามารถลบ Collection ได้');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Training Dashboard</h1>
      
      <div className="mb-6">
        <label className="block mb-2">เลือก Model:</label>
        {loadingModels ? (
          <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
        ) : (
          <select 
            className="border p-2 rounded w-full max-w-md"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={models.length === 1}
          >
            <option value="">-- เลือก Model --</option>
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label>เลือก Collection:</label>
          <button
            onClick={() => setShowNewCollectionForm(true)}
            className="text-blue-600 hover:text-blue-800"
          >
            + สร้าง Collection ใหม่
          </button>
        </div>
        
        {loadingCollections ? (
          <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">-- เลือก Collection --</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </select>
            {selectedCollection && (
              <button
                onClick={() => handleDeleteCollection(selectedCollection)}
                className="mt-1 p-2 text-red-600 hover:text-red-800"
                title="ลบ Collection"
              >
                <FaTrash />
              </button>
            )}
          </div>
        )}
      </div>

      {showNewCollectionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-xl mb-4">สร้าง Collection ใหม่</h2>
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              className="border p-2 rounded w-full mb-4"
              placeholder="ชื่อ Collection"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewCollectionForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                ยกเลิก
              </button>
              <button
                onClick={createNewCollection}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                สร้าง
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedModel && selectedCollection && (
        <form onSubmit={handleFileUpload} className="mt-6">
          <div className="mb-4">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mb-4"
            />
          </div>
          <button
            type="submit"
            disabled={!file || loading}
            className={`px-4 py-2 rounded text-white
              ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {loading ? 'กำลังประมวลผล...' : 'อัพโหลด'}
          </button>
        </form>
      )}
    </div>
  );
};

export default TrainingDashboard; 