import React, { useRef, useEffect, useState } from 'react';
import { FaTrash } from 'react-icons/fa';
import { CollectionExtended, CollectionPermission } from '../utils/types';
import { BaseModal } from './BaseModal';

interface CollectionSettingsModalProps {
  collection: CollectionExtended;
  onClose: () => void;
  onUpdateCollection: (collectionId: string, updates: { name?: string; permission?: CollectionPermission }) => void;
  onDeleteCollection: (collectionId: string) => void;
  isAdmin: boolean;
}

export const CollectionSettingsModal: React.FC<CollectionSettingsModalProps> = ({
  collection,
  onClose,
  onUpdateCollection,
  onDeleteCollection,
  isAdmin,
}) => {
  const [name, setName] = useState(collection.name);
  const [isPrivate, setIsPrivate] = useState(collection.isPrivate || 
    collection.permission === CollectionPermission.PRIVATE);
  const [nameError, setNameError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Validate name input
  useEffect(() => {
    if (name.trim() === '') {
      setNameError('Collection name cannot be empty');
    } else if (name.length > 50) {
      setNameError('Collection name must be less than 50 characters');
    } else {
      setNameError('');
    }
  }, [name]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle save changes
  const handleSave = async () => {
    const currentIsPrivate = collection.isPrivate || 
      collection.permission === CollectionPermission.PRIVATE;
      
    if (nameError || (name === collection.name && isPrivate === currentIsPrivate)) {
      return;
    }

    setIsSaving(true);
    try {
      const updates: { name?: string; permission?: CollectionPermission } = {};
      
      if (name !== collection.name) {
        updates.name = name;
      }
      
      if (isPrivate !== currentIsPrivate) {
        updates.permission = isPrivate ? CollectionPermission.PRIVATE : CollectionPermission.PUBLIC;
      }
      
      if (Object.keys(updates).length > 0) {
        await onUpdateCollection(collection.id, updates);
      }
    } catch (error) {
      console.error('Failed to update collection', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete collection
  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteCollection(collection.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete collection', error);
      setIsDeleting(false);
    }
  };

  return (
    <BaseModal 
      onClose={onClose} 
      containerClasses="w-full max-w-md relative"
    >
      <div ref={modalRef} data-modal="settings" className="relative">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Collection Settings
        </h2>

        <form className="space-y-6">
          <div>
            <label htmlFor="collection-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collection Name
            </label>
            <input
              id="collection-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-lg border ${
                nameError 
                  ? 'border-red-300 dark:border-red-500 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              } dark:bg-gray-800 dark:text-white transition-colors duration-200`}
            />
            {nameError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
            )}
          </div>

          {isAdmin && (
            <div>
              <div className="flex items-center">
                <input
                  id="collection-privacy"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="h-5 w-5 text-blue-600 dark:text-blue-500 
                  focus:ring-blue-500 dark:focus:ring-blue-400 rounded 
                  border-gray-300 dark:border-gray-600 transition-colors duration-200"
                />
                <label htmlFor="collection-privacy" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Private Collection
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Private collections are only visible to you and admins
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!!nameError || isSaving || (name === collection.name && isPrivate === (collection.isPrivate || collection.permission === CollectionPermission.PRIVATE))}
              className={`w-full px-6 py-2.5 rounded-lg font-medium 
              transition-all duration-200 flex items-center justify-center
              ${
                nameError || isSaving || (name === collection.name && isPrivate === (collection.isPrivate || collection.permission === CollectionPermission.PRIVATE))
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving Changes...
                </>
              ) : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className={`w-full px-6 py-2.5 rounded-lg font-medium 
              transition-all duration-200 flex items-center justify-center
              ${deleteConfirm 
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white'
                : 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500 hover:bg-red-50 dark:hover:bg-gray-600'
              } ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  {deleteConfirm ? 'Confirm Delete' : (
                    <>
                      <FaTrash className="mr-2" size={16} />
                      Delete Collection
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </BaseModal>
  );
}; 