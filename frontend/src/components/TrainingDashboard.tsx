import React, { useState } from 'react';

const TrainingDashboard: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modelId, setModelId] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !modelId) {
      alert('Please select a file and enter a model ID.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('modelId', modelId);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setUploadStatus('File uploaded successfully!');
      } else {
        const errorData = await res.json();
        setUploadStatus(`Error uploading file: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus('Error uploading file.');
    }
  };

  return (
    <div>
      <h2>Training Dashboard</h2>
      <form onSubmit={handleUpload}>
        <div>
          <label htmlFor="modelId">Model ID:</label>
          <input
            type="text"
            id="modelId"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="file">Choose File:</label>
          <input type="file" id="file" onChange={handleFileChange} />
        </div>
        <button type="submit">Upload File</button>
      </form>
      {uploadStatus && <p>{uploadStatus}</p>}
    </div>
  );
};

export default TrainingDashboard; 