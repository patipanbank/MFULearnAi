import React, { useState, useMemo } from 'react';
import { FiX, FiGlobe, FiUsers, FiLock } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import { useUIStore, useAuthStore } from '../../shared/stores';
import type { Collection } from '../../shared/types';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (collection: Collection) => void;
}

const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [permission, setPermission] = useState<'PUBLIC' | 'DEPARTMENT' | 'PRIVATE'>('PRIVATE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useUIStore();
  const { user } = useAuthStore();

  // Get available permission options based on user role
  const availablePermissions = useMemo(() => {
    if (!user) return [{ value: 'PRIVATE', label: 'Private', icon: FiLock, description: 'Only you can access' }];

    const permissions = [{ value: 'PRIVATE', label: 'Private', icon: FiLock, description: 'Only you can access' }];

    // Staff, Admin, SuperAdmin can create department collections
    if (['Staffs', 'Admin', 'SuperAdmin'].includes(user.role)) {
      permissions.push({ value: 'DEPARTMENT', label: 'Department', icon: FiUsers, description: `Accessible by ${user.department || 'your department'} members` });
    }

    // Only Admin and SuperAdmin can create public collections
    if (['Admin', 'SuperAdmin'].includes(user.role)) {
      permissions.push({ value: 'PUBLIC', label: 'Public', icon: FiGlobe, description: 'Anyone can access' });
    }

    return permissions;
  }, [user]);

  // Set default permission to first available option
  React.useEffect(() => {
    if (availablePermissions.length > 0) {
      setPermission(availablePermissions[0].value as 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE');
    }
  }, [availablePermissions]);

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
        <div className="space-y-3 mb-6">
          {availablePermissions.map((permOption) => {
            const IconComponent = permOption.icon;
            const isSelected = permission === permOption.value;
            return (
              <div
                key={permOption.value}
                className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-border bg-card hover:border-border-hover'
                }`}
                onClick={() => setPermission(permOption.value as 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE')}
              >
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 p-2 rounded-lg ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-secondary text-muted'
                  }`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium text-sm ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-primary'
                    }`}>
                      {permOption.label}
                    </div>
                    <div className={`text-xs mt-1 ${
                      isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-secondary'
                    }`}>
                      {permOption.description}
                    </div>
                  </div>
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-border'
                  }`}>
                    {isSelected && (
                      <div className="w-full h-full rounded-full bg-white transform scale-50"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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