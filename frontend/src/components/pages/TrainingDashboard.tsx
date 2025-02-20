import React, { useState, useEffect } from 'react';
import { config } from '../../config/config';
import { FaTrash, FaGlobe, FaFile } from 'react-icons/fa';
import { CollectionPermission } from '../../types/collection';

/**
 * Interface representing a collection card.
 * (Assumes the API returns a `created` property; if not, a fallback is provided.)
 */
interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string; // ISO date string representing when the collection was updated/created.
}

// New interface representing an uploaded file, grouping its document chunks
interface UploadedFile {
  filename: string;
  uploadedBy: string;
  timestamp: string;
  ids: string[];
}

const KnowledgeDashboard: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  // const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [trainingMode, setTrainingMode] = useState<'file' | 'url'>('file');
  const [urls, setUrls] = useState<string>('');
  const [isProcessingUrls, setIsProcessingUrls] = useState(false);
  const [newCollectionPermission, setNewCollectionPermission] = useState(CollectionPermission.PRIVATE);

  // New state to hold the list of uploaded files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // State for the search query to filter collections.
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchModels();
    fetchCollections();
  }, []);

  // Whenever a collection is selected update the file overview
  useEffect(() => {
    if (selectedCollection) {
      fetchUploadedFiles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollection]);

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
      // If the API response does not include a created timestamp, use the current date as a fallback.
      const collectionsWithDate: Collection[] = data.map((collection: any) => ({
        ...collection,
        created: collection.created || new Date().toISOString()
      }));
      setCollections(collectionsWithDate);
      if (data.length === 1) {
        setSelectedCollection(data[0].name);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const getFilteredCollections = () => {
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const isStaff = userData.groups?.includes('Staffs');

    return collections.filter(collection => {
      if (collection.permission === CollectionPermission.PUBLIC) {
        return isStaff;
      }
      
      return collection.createdBy === userData.nameID;
    });
  };

  // New function to fetch uploaded files from the selected collection.
  // It groups document chunks by file (using filename and uploadedBy).
  const fetchUploadedFiles = async () => {
    if (!selectedCollection) return;
    try {
      const response = await fetch(
        `${config.apiUrl}/api/training/documents?collectionName=${encodeURIComponent(selectedCollection)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch uploaded files');
      }
      const data = await response.json();
      // Expected response structure: { ids: string[], documents: string[], metadatas: any[] }
      const fileMap: Map<string, UploadedFile> = new Map();

      if (data && Array.isArray(data.ids) && Array.isArray(data.metadatas)) {
        for (let i = 0; i < data.ids.length; i++) {
          const id = data.ids[i];
          const metadata = data.metadatas[i];
          const key = `${metadata.filename}_${metadata.uploadedBy}`;
          if (fileMap.has(key)) {
            fileMap.get(key)!.ids.push(id);
          } else {
            fileMap.set(key, {
              filename: metadata.filename,
              uploadedBy: metadata.uploadedBy,
              timestamp: metadata.timestamp,
              ids: [id]
            });
          }
        }
      }
      setUploadedFiles(Array.from(fileMap.values()));
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) {
      alert('Please enter collection name');
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ name: newCollectionName, permission: newCollectionPermission })
      });

      if (response.ok) {
        await fetchCollections();
        setSelectedCollection(newCollectionName);
        setNewCollectionName('');
        setShowNewCollectionForm(false);
      } else {
        alert('Failed to create collection');
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Error creating collection');
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isUploading) {
      console.log('Upload already in progress');
      return;
    }

    if (!file || !selectedModel || !selectedCollection) {
      alert('Please select Model, Collection and file');
      return;
    }

    setIsUploading(true);
    console.log('Starting upload...');

    try {
      const controller = new AbortController(); // สร้าง controller สำหรับ abort
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 3600000); // timeout 1 ชั่วโมง (3600000 ms)

      const formData = new FormData();
      formData.append('file', file);
      formData.append('modelId', selectedModel);
      formData.append('collectionName', selectedCollection);

      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData,
        signal: controller.signal // ใช้ signal จาก controller
      });

      clearTimeout(timeoutId); // ยกเลิก timeout เมื่อได้รับ response

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      console.log('Upload result:', result);

      alert('Upload file successfully');
      setFile(null);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Refresh the file overview after a successful upload
      fetchUploadedFiles();
      
    } catch (error) {
      console.error('Upload error:', error);
      // ตรวจสอบว่าเป็น error จาก timeout หรือไม่
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Upload is still processing...');
        // ไม่แสดง alert error เพราะการอัพโหลดยังดำเนินอยู่
        // แต่อาจจะแสดงข้อความว่ากำลังประมวลผลแทน
        alert('File is being processed. Please wait...');
      } else {
        alert('Upload file failed');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // New function to delete an entire file.
  // It sends a DELETE request for each document chunk associated with the file.
  const handleDeleteFile = async (file: UploadedFile) => {
    if (!selectedCollection) return;

    if (!window.confirm(`Are you sure you want to delete file "${decodeURIComponent(file.filename)}"?`)) {
      return;
    }

    try {
      const button = document.querySelector(`button[title="Delete File"]`);
      if (button) {
        button.innerHTML = '<span class="animate-spin">⌛</span>';
        button.setAttribute('disabled', 'true');
      }

      // หา element ที่แสดงจำนวน chunks
      const chunksElement = button?.closest('li')?.querySelector('p:last-child');
      const totalChunks = file.ids.length;
      let deletedChunks = 0;

      // ลบไฟล์ทีละ chunk และอัพเดทการแสดงผล
      for (const id of file.ids) {
        await fetch(
          `${config.apiUrl}/api/training/documents/${id}?collectionName=${encodeURIComponent(selectedCollection)}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        );

        deletedChunks++;
        if (chunksElement) {
          chunksElement.textContent = `Chunks: ${totalChunks - deletedChunks} (Deleting: ${deletedChunks}/${totalChunks})`;
        }
      }

      await fetchUploadedFiles();
      alert(`Delete file "${decodeURIComponent(file.filename)}" successfully`);

    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file');
    } finally {
      const button = document.querySelector(`button[title="Delete File"]`);
      if (button) {
        button.innerHTML = '<svg>...</svg>'; // FaTrash icon
        button.removeAttribute('disabled');
      }
    }
  };

  const handleDeleteCollection = async (collectionName: string) => {
    if (!window.confirm(`Are you sure you want to delete Collection "${collectionName}"?`)) {
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

      fetchCollections();
    } catch (error) {
      console.error('Error:', error);
      alert('Cannot delete collection');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isProcessingUrls) {
      return;
    }

    if (!urls.trim() || !selectedModel || !selectedCollection) {
      alert('Please select Model, Collection and URLs');
      return;
    }

    setIsProcessingUrls(true);

    try {
      const urlList = urls.split('\n').map(url => url.trim()).filter(url => url);
      
      const response = await fetch(`${config.apiUrl}/api/training/add-urls`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls: urlList,
          modelId: selectedModel,
          collectionName: selectedCollection
        })
      });

      if (!response.ok) {
        throw new Error('URL processing failed');
      }

      alert('URLs processed successfully');
      setUrls('');
      // NEW: Refresh the uploaded files list after URL training
      fetchUploadedFiles();
    } catch (error) {
      console.error('URL processing error:', error);
      alert('Failed to process URLs');
    } finally {
      setIsProcessingUrls(false);
    }
  };

  /**
   * Converts an ISO date string into a relative time format.
   * For example, returns "Updated 5 minutes ago", "Updated 2 hours ago", etc.
   */
  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = diff / 1000;
    if (seconds < 60) return 'Updated just now';
    const minutes = seconds / 60;
    if (minutes < 60) return `Updated ${Math.floor(minutes)} minutes ago`;
    const hours = minutes / 60;
    if (hours < 24) return `Updated ${Math.floor(hours)} hours ago`;
    const days = hours / 24;
    return `Updated ${Math.floor(days)} days ago`;
  };

  // Filter collections by the search query (ignoring case).
  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 font-sans">
      {/* Header area: Displays the page title and search bar */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-6">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Knowledge 11</h1>
        <input
          type="text"
          placeholder="Search Knowledge"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-gray-300 rounded px-4 py-2 w-full md:w-1/3"
        />
      </header>

      {/* Grid of Collection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filteredCollections.map((collection) => (
          <div 
            key={collection.id} 
            className="border border-gray-200 rounded p-4 shadow hover:shadow-md transition-shadow duration-200"
          >
            {/* "COLLECTION" label */}
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">COLLECTION</div>
            {/* Title */}
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {collection.name}
            </h2>
            {/* Author name */}
            <p className="text-sm text-gray-600 mb-1">By {collection.createdBy}</p>
            {/* Date/Time updated info */}
            <p className="text-sm text-gray-500">{getRelativeTime(collection.created)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeDashboard; 