import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';

interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
}

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (collection: Collection) => void;
}

const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [permission, setPermission] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [modelId, setModelId] = useState('anthropic.claude-3-5-sonnet-20240620-v1:0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useUIStore();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      addToast({
        type: 'warning',
        title: 'Name Required',
        message: 'Please enter a collection name.'
      });
      return;
    }
    
    const trimmedName = name.trim();
    
    // Frontend validation
    if (trimmedName.length < 3) {
      addToast({
        type: 'warning',
        title: 'Name Too Short',
        message: 'Collection name must be at least 3 characters long.'
      });
      return;
    }
    
    if (trimmedName.length > 100) {
      addToast({
        type: 'warning',
        title: 'Name Too Long',
        message: 'Collection name cannot exceed 100 characters.'
      });
      return;
    }
    
    // Check for invalid characters
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(trimmedName)) {
      addToast({
        type: 'warning',
        title: 'Invalid Characters',
        message: 'Collection name can only contain letters, numbers, spaces, hyphens, and underscores.'
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newCol = await api.post<Collection>('/collections/', { 
        name: trimmedName,
        permission: permission,
        modelId: modelId
      });
      onCreated(newCol);
      addToast({
        type: 'success',
        title: 'Collection Created',
        message: `Created "${newCol.name}" successfully.`
      });
      setName('');
      setPermission('PRIVATE');
      onClose();
    } catch (err: any) {
      console.error('Failed to create collection', err);
      
      // Extract error message from response
      let errorMessage = 'Unable to create collection.';
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay flex items-center justify-center z-40">
      <div className="modal-content w-full max-w-md bg-primary p-6 rounded-xl relative shadow-xl">
        {/* Close button */}
        <button className="absolute top-4 right-4 btn-ghost p-1" onClick={onClose}>
          <FiX className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-semibold text-primary mb-1">Create New Collection</h2>
        <p className="text-secondary mb-6">Create a new collection to organize your training documents.</p>

        <label className="block text-sm font-medium text-primary mb-2">Collection Name</label>
        <input
          type="text"
          className="input w-full mb-4"
          placeholder="Enter collection name (3-100 characters, letters, numbers, spaces, - _)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="block text-sm font-medium text-primary mb-2">Permission</label>
        <select
          className="input w-full mb-4"
          value={permission}
          onChange={(e) => setPermission(e.target.value as 'PUBLIC' | 'PRIVATE')}
        >
          <option value="PRIVATE">Private - Only you can access</option>
          <option value="PUBLIC">Public - Anyone can access</option>
        </select>

        <label className="block text-sm font-medium text-primary mb-2">Embedding Model</label>
        <select
          className="input w-full mb-6"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
        >
          <option value="anthropic.claude-3-5-sonnet-20240620-v1:0">Claude 3.5 Sonnet (Recommended)</option>
          <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
          <option value="amazon.titan-embed-text-v1">Titan Embeddings</option>
        </select>

        <button
          onClick={handleSubmit}
          className="btn-primary w-full mb-3 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Collection'}
        </button>

        <button onClick={onClose} className="btn-ghost w-full">Cancel</button>
      </div>
    </div>
  );
};

export default CreateCollectionModal; 