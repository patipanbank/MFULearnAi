import React, { useState } from 'react';
import { config } from '../../config/config';

const TrainingDashboard: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading] = useState(false);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Sending request to:', `${config.apiUrl}/api/training/upload`);
      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      alert('File uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AI Training Dashboard</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Upload Training Data</h2>
        
        <form onSubmit={handleFileUpload}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Select File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full p-2 border rounded"
              accept=".pdf,.txt,.doc,.docx"
            />
          </div>
          
          <button
            type="submit"
            disabled={!file || loading}
            className={`px-4 py-2 rounded text-white
              ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {loading ? 'Processing...' : 'Upload'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TrainingDashboard; 