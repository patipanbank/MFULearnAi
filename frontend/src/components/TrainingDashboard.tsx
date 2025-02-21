import React, { useState, useEffect } from 'react';

interface Model {
  id: string;
  name: string;
  collections: string[];
}

const TrainingDashboard: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modelId, setModelId] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  // Fetch list of models when the component mounts.
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/models');
        if (res.ok) {
          const data = await res.json();
          setModels(data.models);
        } else {
          console.error('Error fetching models.');
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    }
    fetchModels();
  }, []);

  // When a model is selected (modelId changes), fetch its details and log collections.
  useEffect(() => {
    if (modelId) {
      async function fetchModelDetails() {
        try {
          const res = await fetch(`/api/models/${modelId}`);
          if (res.ok) {
            const model = await res.json();
            setSelectedModel(model);
            console.log(`Model changed to: ${model.name}`);
            console.log('Collections:', model.collections);
          } else {
            console.error('Failed to fetch model details.');
          }
        } catch (error) {
          console.error('Error fetching model details:', error);
        }
      }
      fetchModelDetails();
    }
  }, [modelId]);

  useEffect(() => {
    if (selectedModel) {
      console.log("Currently selected model:", selectedModel);
    }
  }, [selectedModel]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !modelId) {
      alert('Please select a file and choose a model.');
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

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setModelId(e.target.value);
  };

  return (
    <div>
      <h2>Training Dashboard</h2>
      <div>
        <label htmlFor="modelSelect">Select Model:</label>
        <select id="modelSelect" value={modelId} onChange={handleModelChange}>
          <option value="">--Select a model--</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      <form onSubmit={handleUpload}>
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