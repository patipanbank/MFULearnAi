import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiDatabase } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';

interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
  department?: string;
  modelId?: string;
}

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
  onUpdated: (updatedCollection: Collection) => void;
}

const EditCollectionModal: React.FC<EditCollectionModalProps> = ({
  isOpen,
  onClose,
  collection,
  onUpdated
}) => {
  const [formData, setFormData] = useState({
    name: '',
    permission: 'PRIVATE',
    modelId: ''
  });
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const { addToast } = useUIStore();

  useEffect(() => {
    if (collection) {
      setFormData({
        name: collection.name,
        permission: collection.permission,
        modelId: collection.modelId || ''
      });
    }
  }, [collection]);

  useEffect(() => {
    if (isOpen) {
      fetchModels();
    }
  }, [isOpen]);

  const fetchModels = async () => {
    try {
      const response = await api.get<{ models: string[] }>('/bedrock/models');
      setModels(response.models || []);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;

    setLoading(true);
    try {
      const updatedCollection = await api.put<Collection>(`/collections/${collection.id}`, formData);
      onUpdated(updatedCollection);
      addToast({
        type: 'success',
        title: 'Collection Updated',
        message: 'Collection has been updated successfully.'
      });
      onClose();
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update collection.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen || !collection) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FiDatabase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Edit Collection</h2>
              <p className="text-sm text-muted">Update collection settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Collection Name */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Collection Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="input w-full"
              placeholder="Enter collection name"
              required
            />
          </div>

          {/* Permission */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Permission
            </label>
            <select
              value={formData.permission}
              onChange={(e) => handleInputChange('permission', e.target.value)}
              className="input w-full"
            >
              <option value="PRIVATE">Private</option>
              <option value="DEPARTMENT">Department</option>
              <option value="PUBLIC">Public</option>
            </select>
            <p className="text-xs text-muted mt-1">
              {formData.permission === 'PRIVATE' && 'Only you can access this collection'}
              {formData.permission === 'DEPARTMENT' && 'Members of your department can access this collection'}
              {formData.permission === 'PUBLIC' && 'Everyone can access this collection'}
            </p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Embedding Model (Optional)
            </label>
            <select
              value={formData.modelId}
              onChange={(e) => handleInputChange('modelId', e.target.value)}
              className="input w-full"
            >
              <option value="">Use default model</option>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-1">
              Choose a specific embedding model for this collection
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
              disabled={loading}
            >
              <FiSave className="h-4 w-4" />
              <span>{loading ? 'Updating...' : 'Update Collection'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCollectionModal; 