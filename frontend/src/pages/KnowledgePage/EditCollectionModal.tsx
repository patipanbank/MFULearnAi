import React, { useState, useEffect } from 'react';
import { FiSave, FiEdit } from 'react-icons/fi';
import { RAGService } from '../../services/api';
import { useUIStore } from '../../shared/stores';
import UniversalModal from '../../shared/ui/UniversalModal';
import type { Collection } from '../../shared/types';

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
      const response = await RAGService.getBedrockModels();
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
      const updatedCollection = await RAGService.updateCollection(collection._id, formData as any);
      onUpdated(updatedCollection as any);
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

  if (!collection) return null;

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      modalType="edit-collection"
      title="Edit Collection"
      subtitle="Update collection settings"
      headerIcon={<FiEdit className="h-6 w-6 text-primary" />}
      closeOnOutsideClick={true}
      closeOnEscape={true}
      blur={true}
    >
      <div className="p-6">

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
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
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
    </UniversalModal>
  );
};

export default EditCollectionModal; 