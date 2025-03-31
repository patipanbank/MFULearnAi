import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { BaseModal } from './BaseModal';

// Helper function to validate collection name
const isValidCollectionName = (name: string): boolean => {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(name);
};

// Helper function to get error message
const getCollectionNameError = (name: string): string => {
  if (!name.trim()) {
    return 'Collection name is required';
  }
  if (name.length < 3) {
    return 'Collection name must be at least 3 characters';
  }
  if (name.length > 50) {
    return 'Collection name must be less than 50 characters';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return 'Collection name can only contain letters, numbers, dashes, and underscores';
  }
  return '';
};

interface NewCollectionModalProps {
  onSubmit: (e: FormEvent, name: string, isPrivate: boolean) => void;
  onCancel: () => void;
  isAdmin: boolean;
}

export const NewCollectionModal: React.FC<NewCollectionModalProps> = ({
  onSubmit,
  onCancel,
  isAdmin
}) => {
  // Local state for form values
  const [collectionName, setCollectionName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [nameError, setNameError] = useState<string>('');

  // Add ref for click outside detection
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Validate name when there's a change
  const handleNameChange = (value: string) => {
    setCollectionName(value);
    setNameError(getCollectionNameError(value));
  };

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isValidCollectionName(collectionName)) {
      onSubmit(e, collectionName, isPrivate);
    }
  };

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  return (
    <BaseModal onClose={onCancel} containerClasses="w-[28rem]">
      <div ref={modalRef} className="relative">
        <div className="mb-6">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Create New Collection
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create a new collection to organize your training documents.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Name
            </label>
            <input
              type="text"
              placeholder="Enter collection name (English letters, numbers, - and _ only)"
              value={collectionName}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border 
                ${nameError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
                placeholder-gray-500 dark:placeholder-gray-400`}
            />
            {nameError && (
              <p className="mt-2 text-sm text-red-500 dark:text-red-400">
                {nameError}
              </p>
            )}
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Access Permission
              </label>
              <select
                value={isPrivate ? 'PRIVATE' : 'PUBLIC'}
                onChange={(e) => setIsPrivate(e.target.value === 'PRIVATE')}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              >
                <option value="PRIVATE">Private - Only you can access</option>
                <option value="PUBLIC">Public - Everyone can access</option>
              </select>
            </div>
          )}
          <div className="flex flex-col space-y-2 pt-4">
            <button
              type="submit"
              disabled={!isValidCollectionName(collectionName)}
              className={`w-full px-4 py-2 rounded-lg font-medium 
                transform transition-all duration-200
                ${isValidCollectionName(collectionName)
                  ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
            >
              Create Collection
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
              transform transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </BaseModal>
  );
}; 