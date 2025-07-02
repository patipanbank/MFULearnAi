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
    setIsSubmitting(true);
    try {
      const newCol = await api.post<Collection>('/collections/', { name: name.trim() });
      onCreated(newCol);
      addToast({
        type: 'success',
        title: 'Collection Created',
        message: `Created "${newCol.name}" successfully.`
      });
      setName('');
      onClose();
    } catch (err) {
      console.error('Failed to create collection', err);
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Unable to create collection.'
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
          className="input w-full mb-6"
          placeholder="Enter collection name (English letters, numbers, - _)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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