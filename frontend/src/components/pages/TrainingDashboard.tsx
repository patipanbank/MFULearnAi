import React, { useEffect, useState, useCallback, FormEvent } from 'react';
import { useTrainingStore } from '../training/store/trainingStore';
import { DashboardHeader } from '../training/ui/DashboardHeader';
import { CollectionGrid } from '../training/ui/CollectionGrid';
import { NewCollectionModal } from '../training/ui/NewCollectionModal';
import { CollectionModal } from '../training/ui/CollectionModal';
import { CollectionSettingsModal } from '../training/ui/CollectionSettingsModal';
import { CollectionExtended, CollectionPermission, UploadedFile } from '../training/utils/types';

export const TrainingDashboard: React.FC = () => {
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [activeCollection, setActiveCollection] = useState<CollectionExtended | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Get state and actions from the store
  const {
    collections,
    uploadedFiles,
    isLoading,
    isUploading,
    userInfo,
    fetchUserInfo,
    fetchCollections,
    fetchCollectionFiles,
    handleCreateCollection,
    handleUploadFile,
    handleDeleteFile,
    handleUpdateCollection,
    handleDeleteCollection
  } = useTrainingStore();

  // Initialize data
  useEffect(() => {
    fetchUserInfo();
    fetchCollections();
  }, [fetchUserInfo, fetchCollections]);

  // Check if user has permission to edit a collection
  const hasEditPermission = useCallback((collection: CollectionExtended) => {
    if (!userInfo || !collection) return false;
    
    // Admin users can edit any collection
    if (userInfo.isAdmin) return true;
    
    // Regular users can only edit collections they created
    return collection.createdBy === userInfo.name;
  }, [userInfo]);

  // Handle collection creation
  const handleNewCollection = useCallback(
    (e: FormEvent, name: string, isPrivate: boolean) => {
      e.preventDefault();
      handleCreateCollection(name, isPrivate);
      setShowNewCollection(false);
    },
    [handleCreateCollection]
  );

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedFile && activeCollection && hasEditPermission(activeCollection)) {
        await handleUploadFile(activeCollection.id, selectedFile);
        setSelectedFile(null);
        // Reset the file input
        const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    },
    [selectedFile, activeCollection, handleUploadFile, hasEditPermission]
  );

  // Handle file deletion
  const handleDeleteFileAction = useCallback(
    (file: UploadedFile) => {
      if (activeCollection && hasEditPermission(activeCollection)) {
        handleDeleteFile(activeCollection.id, file.id);
      }
    },
    [activeCollection, handleDeleteFile, hasEditPermission]
  );

  // Get files for active collection
  const collectionFiles = activeCollection
    ? uploadedFiles.filter((file) => file.collectionId === activeCollection.id)
    : [];

  // Handle collection click
  const handleCollectionClick = useCallback((collection: CollectionExtended) => {
    setActiveCollection(collection);
    fetchCollectionFiles(collection.id);
  }, [fetchCollectionFiles]);

  // Handle collection settings
  const handleShowSettings = useCallback(() => {
    if (activeCollection && hasEditPermission(activeCollection)) {
      setShowSettings(true);
    }
  }, [activeCollection, hasEditPermission]);

  // Handle collection update
  const handleUpdateCollectionAction = useCallback(
    async (collectionId: string, updates: { name?: string; permission?: CollectionPermission }) => {
      const collection = collections.find(c => c.id === collectionId);
      if (collection && hasEditPermission(collection)) {
        await handleUpdateCollection(collectionId, updates);
        setShowSettings(false);
      }
    },
    [collections, handleUpdateCollection, hasEditPermission]
  );

  // Handle collection deletion
  const handleDeleteCollectionAction = useCallback(
    async (collectionId: string) => {
      const collection = collections.find(c => c.id === collectionId);
      if (collection && hasEditPermission(collection)) {
        await handleDeleteCollection(collectionId);
        setActiveCollection(null);
        setShowSettings(false);
      }
    },
    [collections, handleDeleteCollection, hasEditPermission]
  );

  // Close modals
  const handleCloseCollectionModal = useCallback(() => {
    setActiveCollection(null);
    setShowSettings(false);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Dashboard Header */}
      <DashboardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewCollectionToggle={() => setShowNewCollection(true)}
        loading={isLoading}
      />

      {/* Collection Grid */}
      <div className="mt-8">
        <CollectionGrid
          collections={collections}
          onCollectionClick={handleCollectionClick}
          loading={isLoading}
          searchQuery={searchQuery}
          onNewCollectionToggle={() => setShowNewCollection(true)}
        />
      </div>

      {/* New Collection Modal */}
      {showNewCollection && (
        <NewCollectionModal
          onSubmit={handleNewCollection}
          onCancel={() => setShowNewCollection(false)}
          isAdmin={userInfo?.isAdmin || false}
        />
      )}

      {/* Collection Modal */}
      {activeCollection && (
        <CollectionModal
          collection={activeCollection}
          onClose={handleCloseCollectionModal}
          uploadedFiles={collectionFiles}
          onFileChange={handleFileChange}
          onFileUpload={handleFileUpload}
          uploadLoading={isUploading}
          onShowSettings={hasEditPermission(activeCollection) ? handleShowSettings : undefined}
          onDeleteFile={handleDeleteFileAction}
        />
      )}

      {/* Collection Settings Modal */}
      {activeCollection && showSettings && hasEditPermission(activeCollection) && (
        <CollectionSettingsModal
          collection={activeCollection}
          onClose={() => setShowSettings(false)}
          onUpdateCollection={handleUpdateCollectionAction}
          onDeleteCollection={handleDeleteCollectionAction}
          isAdmin={userInfo?.isAdmin || false}
        />
      )}
    </div>
  );
};  

export default TrainingDashboard;