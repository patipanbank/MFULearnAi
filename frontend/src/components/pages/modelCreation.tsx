import React, { useEffect, useMemo, useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useModelStore } from '../models/store/modelStore';
import { Model } from '../models/utils/types';
import { ModelCard } from '../models/ui/ModelCard';
import { NewModelModal } from '../models/ui/NewModelModal';
import { ModelCollectionsModal } from '../models/ui/ModelCollectionsModal';
import { EditModelModal } from '../models/ui/EditModelModal';
import { ModelSearchBar } from '../models/ui/ModelSearchBar';
import { LoadingSpinner } from '../models/ui/LoadingSpinner';

export const ModelCreation: React.FC = () => {
  const { isAdmin, isSuperAdmin, user } = useAuth();
  
  // Get state and actions from the store
  const {
    // State
    models,
    isLoading,
    isModelsLoading,
    isDeleting,
    
    availableCollections,
    selectedCollections,
    isCollectionsLoading,
    isSavingCollections,
    editingModel,
    searchQuery,
    
    showNewModelModal,
    newModelName,
    newModelType,
    departmentName,
    isCreating,
    
    // Bulk operations state
    selectedModels,
    showBulkActions,
    isBulkDeleting,
    bulkActionResults,
    
    // Edit state
    isUpdating,
    
    // Actions
    setShowNewModelModal,
    setNewModelName,
    setNewModelType,
    setSearchQuery,
    setEditingModel,
    
    // Bulk operations actions
    toggleModelSelection,
    selectAllModels,
    clearSelection,
    setShowBulkActions,
    
    // Thunks
    fetchModels,
    createModel,
    updateModel,
    deleteModel,
    bulkDeleteModels,
    searchModels,
    fetchCollections,
    toggleCollectionSelection,
    confirmCollections
  } = useModelStore();

  // Local state for edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingModelData, setEditingModelData] = useState<Model | null>(null);
  
  // Local state for search
  const [searchResults, setSearchResults] = useState<Model[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Load models when component mounts
  useEffect(() => {
    fetchModels();
  }, []);
  
  // Fetch collections when editingModel changes
  useEffect(() => {
    if (editingModel) {
      fetchCollections();
    }
  }, [editingModel]);
  
  // Filter models to show only accessible ones
  const filteredModels = useMemo(() => {
    const modelsToFilter = searchResults || models;
    if (!modelsToFilter || !user) return [];
    
    // Filter to show:
    // 1. Models created by the user
    // 2. Models from the user's department
    return modelsToFilter.filter(model => {
      // Condition 1: User created the model
      const isCreator = model.createdBy === user.nameID || model.createdBy === user.username;
      
      // Condition 2: Model is from the user's department
      const isSameDepartment = model.modelType === 'department' && model.department === user.department;
      
      // Condition 3: Model is official (visible to all)
      const isOfficial = model.modelType === 'official';
      
      return isCreator || isSameDepartment || isOfficial;
    });
  }, [models, searchResults, user]);

  // Handle edit model
  const handleEditModel = (model: Model) => {
    setEditingModelData(model);
    setShowEditModal(true);
  };

  // Handle save model updates
  const handleSaveModel = async (updatedData: Partial<Model>) => {
    if (!editingModelData) return;
    
    try {
      await updateModel(editingModelData.id, updatedData);
      setShowEditModal(false);
      setEditingModelData(null);
    } catch (error) {
      console.error('Error updating model:', error);
      alert('Failed to update model. Please try again.');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedModels.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedModels.length} models?`)) return;
    
    await bulkDeleteModels(selectedModels);
  };

  // Handle search
  const handleSearch = async (query: string, filters: any) => {
    if (!query && !filters.modelType && !filters.department) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchModels(query, filters);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching models:', error);
      alert('Failed to search models. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-6 font-sans">
      {isLoading ? (
        <LoadingSpinner message="Loading models..." />
      ) : (
        <>
          <header className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Models</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Create and manage your models for training and chat
                </p>
                {selectedModels.length > 0 && (
                  <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                    {selectedModels.length} models selected
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selectedModels.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkDelete}
                      disabled={isBulkDeleting}
                      className="flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 
                        text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isBulkDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Deleting...
                        </>
                      ) : (
                        <>Delete {selectedModels.length}</>
                      )}
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 
                        dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 
                        rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {filteredModels.length > 0 && (
                    <button
                      onClick={selectedModels.length === filteredModels.length ? clearSelection : selectAllModels}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 
                        dark:hover:text-blue-200 underline"
                    >
                      {selectedModels.length === filteredModels.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowNewModelModal(true)}
                    className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 
                      hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200
                      transform hover:scale-[1.02] shadow-md hover:shadow-lg"
                  >
                    <FaPlus className="mr-2" size={16} />
                    <span className="font-medium">New Model</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Search Bar */}
          <ModelSearchBar
            onSearch={handleSearch}
            isLoading={isSearching}
          />

          {searchResults && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Showing {filteredModels.length} search results
                <button
                  onClick={() => setSearchResults(null)}
                  className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear search
                </button>
              </p>
            </div>
          )}

          {isModelsLoading ? (
            <LoadingSpinner message="Fetching models..." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModels.map((model) => (
                <div key={model.id} className="relative">
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleModelSelection(model.id);
                      }}
                      className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded 
                        focus:ring-blue-500 focus:ring-2 shadow-sm"
                    />
                  </div>
                  <ModelCard
                    model={model}
                    onCollectionsEdit={setEditingModel}
                    onEdit={handleEditModel}
                    onDelete={deleteModel}
                    isDeleting={isDeleting}
                  />
                </div>
              ))}
            </div>
          )}

          {showNewModelModal && (
            <NewModelModal
              newModelName={newModelName}
              newModelType={newModelType}
              isCreating={isCreating}
              isStaff={isAdmin || isSuperAdmin}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              departmentName={departmentName}
              onNameChange={setNewModelName}
              onTypeChange={setNewModelType}
              onDepartmentChange={() => {}} // Not needed as we get department from user token
              onSubmit={createModel}
              onCancel={() => setShowNewModelModal(false)}
            />
          )}
          
          {editingModel && (
            <ModelCollectionsModal
              model={editingModel}
              availableCollections={availableCollections}
              selectedCollections={selectedCollections}
              searchQuery={searchQuery}
              isCollectionsLoading={isCollectionsLoading}
              isSavingCollections={isSavingCollections}
              isReadOnly={!(
                // Model creator
                (user?.nameID === editingModel.createdBy) || 
                (user?.username === editingModel.createdBy) ||
                // Or admin in the same department as the department model
                (editingModel.modelType === 'department' && 
                  isAdmin && 
                  user?.department === editingModel.department)
              )}
              onSearchChange={setSearchQuery}
              onCollectionToggle={toggleCollectionSelection}
              onConfirm={confirmCollections}
              onClose={() => setEditingModel(null)}
            />
          )}

          {/* Bulk Action Results */}
          {bulkActionResults && (
            <div className="fixed bottom-4 right-4 max-w-md bg-white dark:bg-gray-800 
              border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Bulk Delete Results
                  </h4>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Successfully deleted: {bulkActionResults.success}
                  </p>
                  {bulkActionResults.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Errors: {bulkActionResults.errors.length}
                      </p>
                      <div className="max-h-20 overflow-y-auto">
                        {bulkActionResults.errors.map((error, index) => (
                          <p key={index} className="text-xs text-red-500 dark:text-red-400">
                            {error.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => useModelStore.getState().setBulkActionResults(null)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Edit Model Modal */}
          {showEditModal && editingModelData && (
            <EditModelModal
              isOpen={showEditModal}
              onClose={() => {
                setShowEditModal(false);
                setEditingModelData(null);
              }}
              model={editingModelData}
              onSave={handleSaveModel}
              isLoading={isUpdating}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ModelCreation; 