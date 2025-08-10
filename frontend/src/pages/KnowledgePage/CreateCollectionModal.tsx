import React, { useState } from 'react';
import { api } from '../../shared/lib/api';
import { useUIStore } from '../../shared/stores';
import type { Collection } from '../../shared/types';
import EnhancedModal from '../../shared/ui/EnhancedModal';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (collection: Collection) => void;
}

const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [permission, setPermission] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useUIStore();

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
        modelId: 'amazon.titan-embed-text-v1'  // Use Titan embedding model
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

  const footer = (
    <div className="flex items-center justify-end space-x-3">
      <button onClick={onClose} className="btn-ghost">
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        className="btn-primary disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creating...' : 'Create Collection'}
      </button>
    </div>
  );

  return (
    <EnhancedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Collection"
      subtitle="Create a new collection to organize your training documents"
      size="sm"
      animationType="spring"
      enhanced={true}
      footer={footer}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-2">Collection Name</label>
          <input
            type="text"
            className="input w-full"
            placeholder="Enter collection name (3-100 characters, letters, numbers, spaces, - _)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">Permission</label>
          <select
            className="input w-full"
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'PUBLIC' | 'PRIVATE')}
          >
            <option value="PRIVATE">Private - Only you can access</option>
            <option value="PUBLIC">Public - Anyone can access</option>
          </select>
        </div>
      </div>
    </EnhancedModal>
  );
};

export default CreateCollectionModal; 