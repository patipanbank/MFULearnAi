import React from 'react';
import { useModelsStore } from '../../stores/modelsStore';

const ModelSelector: React.FC = () => {
  const { models, selectedModel, setSelectedModel, modelsLoading } = useModelsStore();

  if (modelsLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-muted">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={selectedModel?.id || ''}
        onChange={(e) => {
          const model = models.find(m => m.id === e.target.value);
          setSelectedModel(model || null);
        }}
        className="select text-sm min-w-48"
      >
        <option value="">Select AI Model...</option>
        {models.map(model => (
          <option key={model.id} value={model.id}>
            {model.name} ({model.modelType})
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector; 