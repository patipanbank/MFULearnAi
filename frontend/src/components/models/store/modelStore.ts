import { create } from 'zustand';
import { config } from '../../../config/config';
import { Collection, Model } from '../utils/types';
import { jwtDecode } from 'jwt-decode';

interface ModelState {
  // Model state
  models: Model[];
  isLoading: boolean;
  isModelsLoading: boolean;
  isDeleting: string | null;
  
  // Collections modal state
  availableCollections: Collection[];
  selectedCollections: string[];
  isCollectionsLoading: boolean;
  isSavingCollections: boolean;
  editingModel: Model | null;
  searchQuery: string;
  
  // New model modal state
  showNewModelModal: boolean;
  newModelName: string;
  newModelType: 'official' | 'personal' | 'department';
  departmentName: string;
  isCreating: boolean;
  
  // Bulk operations state
  selectedModels: string[];
  showBulkActions: boolean;
  isBulkDeleting: boolean;
  bulkActionResults: { success: number; errors: any[] } | null;
  
  // Edit model state
  isUpdating: boolean;
  
  // Actions
  setModels: (models: Model[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsModelsLoading: (isLoading: boolean) => void;
  setIsDeleting: (modelId: string | null) => void;
  
  setAvailableCollections: (collections: Collection[]) => void;
  setSelectedCollections: (collections: string[]) => void;
  setIsCollectionsLoading: (isLoading: boolean) => void;
  setIsSavingCollections: (isSaving: boolean) => void;
  setEditingModel: (model: Model | null) => void;
  setSearchQuery: (query: string) => void;
  
  setShowNewModelModal: (show: boolean) => void;
  setNewModelName: (name: string) => void;
  setNewModelType: (type: 'official' | 'personal' | 'department') => void;
  setDepartmentName: (name: string) => void;
  setIsCreating: (isCreating: boolean) => void;
  
  // Bulk operations actions
  setSelectedModels: (models: string[]) => void;
  toggleModelSelection: (modelId: string) => void;
  selectAllModels: () => void;
  clearSelection: () => void;
  setShowBulkActions: (show: boolean) => void;
  setIsBulkDeleting: (isDeleting: boolean) => void;
  setBulkActionResults: (results: { success: number; errors: any[] } | null) => void;
  
  // Edit model actions
  setIsUpdating: (isUpdating: boolean) => void;
  
  // Thunks
  fetchModels: () => Promise<void>;
  fetchModelById: (modelId: string) => Promise<Model>;
  createModel: (e: React.FormEvent) => Promise<void>;
  updateModel: (modelId: string, updates: Partial<Model>) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  bulkDeleteModels: (modelIds: string[]) => Promise<void>;
  searchModels: (query: string, filters?: any) => Promise<Model[]>;
  fetchCollections: () => Promise<void>;
  toggleCollectionSelection: (collectionName: string) => void;
  confirmCollections: () => Promise<void>;
}

export const useModelStore = create<ModelState>((set, get) => ({
  // Initial state
  models: [],
  isLoading: true,
  isModelsLoading: false,
  isDeleting: null,
  
  availableCollections: [],
  selectedCollections: [],
  isCollectionsLoading: false,
  isSavingCollections: false,
  editingModel: null,
  searchQuery: '',
  
  showNewModelModal: false,
  newModelName: '',
  newModelType: 'personal',
  departmentName: '',
  isCreating: false,
  
  // Bulk operations initial state
  selectedModels: [],
  showBulkActions: false,
  isBulkDeleting: false,
  bulkActionResults: null,
  
  // Edit model initial state
  isUpdating: false,
  
  // Basic state setters
  setModels: (models) => set({ models }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsModelsLoading: (isModelsLoading) => set({ isModelsLoading }),
  setIsDeleting: (modelId) => set({ isDeleting: modelId }),
  
  setAvailableCollections: (collections) => set({ availableCollections: collections }),
  setSelectedCollections: (collections) => set({ selectedCollections: collections }),
  setIsCollectionsLoading: (isLoading) => set({ isCollectionsLoading: isLoading }),
  setIsSavingCollections: (isSaving) => set({ isSavingCollections: isSaving }),
  setEditingModel: (model) => set({ editingModel: model }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setShowNewModelModal: (show) => set({ showNewModelModal: show }),
  setNewModelName: (name) => set({ newModelName: name }),
  setNewModelType: (type) => set({ newModelType: type }),
  setDepartmentName: (name) => set({ departmentName: name }),
  setIsCreating: (isCreating) => set({ isCreating: isCreating }),
  
  // Bulk operations setters
  setSelectedModels: (models) => set({ selectedModels: models }),
  toggleModelSelection: (modelId) => {
    const { selectedModels } = get();
    set({
      selectedModels: selectedModels.includes(modelId)
        ? selectedModels.filter(id => id !== modelId)
        : [...selectedModels, modelId]
    });
  },
  selectAllModels: () => {
    const { models } = get();
    set({ selectedModels: models.map(m => m.id) });
  },
  clearSelection: () => set({ selectedModels: [], showBulkActions: false }),
  setShowBulkActions: (show) => set({ showBulkActions: show }),
  setIsBulkDeleting: (isDeleting) => set({ isBulkDeleting: isDeleting }),
  setBulkActionResults: (results) => set({ bulkActionResults: results }),
  
  // Edit model setters
  setIsUpdating: (isUpdating) => set({ isUpdating: isUpdating }),
  
  // Thunks
  fetchModels: async () => {
    const { setIsModelsLoading, setModels, setIsLoading } = get();
    setIsModelsLoading(true);
    
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        console.error('No auth token found');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/models`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          return;
        }
        throw new Error(`Failed to fetch models: ${errorText}`);
      }

      const modelsFromBackend = await response.json();
      const transformedModels: Model[] = modelsFromBackend.map((model: any) => ({
        id: model._id,
        name: model.name,
        collections: model.collections || [],
        modelType: model.modelType,
        department: model.department,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
        createdBy: model.createdBy
      }));

      setModels(transformedModels);
    } catch (error) {
      console.error('Error fetching models:', error);
      if (error instanceof Error) {
        alert(error.message);
      }
    } finally {
      setIsModelsLoading(false);
      setIsLoading(false);
    }
  },
  
  createModel: async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { 
      newModelName, 
      newModelType, 
      setIsCreating, 
      models, 
      setModels, 
      setShowNewModelModal, 
      setNewModelName, 
      setDepartmentName, 
      setNewModelType 
    } = get();
    
    if (!newModelName.trim()) {
      alert('Please enter a model name');
      return;
    }

    // Check if user is in a department when creating a department model
    const token = localStorage.getItem('auth_token');
    if (!token) {
      alert('No auth token found');
      return;
    }
    
    const tokenPayload = jwtDecode(token) as any;
    const userDepartment = tokenPayload.department;
    
    if (newModelType === 'department' && !userDepartment && !tokenPayload.groups?.includes('Admin') && !tokenPayload.groups?.includes('SuperAdmin')) {
      alert('You cannot create a department model without a department assigned to your account');
      return;
    }

    setIsCreating(true);
    
    try {
      const createdBy = tokenPayload.nameID || tokenPayload.username;
      if (!createdBy) {
        throw new Error('No user identifier found in token');
      }

      const response = await fetch(`${config.apiUrl}/api/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newModelName.trim(),
          modelType: newModelType,
          department: newModelType === 'department' ? (userDepartment || 'General') : undefined,
          createdBy
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to create model');
      }

      const data = await response.json();
      const newModel: Model = {
        id: data._id,
        name: data.name,
        collections: data.collections || [],
        modelType: data.modelType,
        department: data.department,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy
      };

      setModels([...models, newModel]);
      setShowNewModelModal(false);
      setNewModelName('');
      setDepartmentName('');
      
      const isAdmin = tokenPayload.groups?.includes('Admin');
      const isSuperAdmin = tokenPayload.groups?.includes('SuperAdmin');
      setNewModelType((isAdmin || isSuperAdmin) ? 'official' : 'personal');
    } catch (error) {
      console.error('Error creating model:', error);
      alert(error instanceof Error ? error.message : 'Failed to create model');
    } finally {
      setIsCreating(false);
    }
  },
  
  deleteModel: async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;

    const { setIsDeleting, models, setModels } = get();
    setIsDeleting(modelId);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete model');
      }

      setModels(models.filter(m => m.id !== modelId));
    } catch (error) {
      console.error('Error deleting model:', error);
      alert('Failed to delete model. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  },
  
  fetchCollections: async () => {
    const { 
      setIsCollectionsLoading, 
      setAvailableCollections, 
      editingModel, 
      setEditingModel,
      setSelectedCollections
    } = get();
    
    if (!editingModel) return;
    
    setIsCollectionsLoading(true);
    
    // Handle both old format (string[]) and new format (object[])
    const currentCollections = editingModel.collections || [];
    const collectionNames = Array.isArray(currentCollections) && currentCollections.length > 0
      ? typeof currentCollections[0] === 'string' 
        ? currentCollections as string[]
        : (currentCollections as Array<{ name: string; description?: string }>).map(c => c.name)
      : [];
    
    setSelectedCollections(collectionNames);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }

      const data = await response.json();
      const transformedCollections = data.map((collection: any) => ({
        id: collection._id?.toString() || collection.id || 'unknown',
        name: collection.name || '',
        createdBy: collection.createdBy || 'Unknown',
        created: collection.created || collection.createdAt || new Date().toISOString(),
        permission: collection.permission || 'PUBLIC'
      }));

      setAvailableCollections(transformedCollections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      alert('Failed to fetch collections. Please try again.');
      setEditingModel(null);
    } finally {
      setIsCollectionsLoading(false);
    }
  },
  
  toggleCollectionSelection: (collectionName: string) => {
    const { selectedCollections, setSelectedCollections } = get();
    
    setSelectedCollections(
      selectedCollections.includes(collectionName)
        ? selectedCollections.filter((name) => name !== collectionName)
        : [...selectedCollections, collectionName]
    );
  },
  
  confirmCollections: async () => {
    const { 
      editingModel, 
      selectedCollections, 
      setIsSavingCollections, 
      models, 
      setModels, 
      setEditingModel 
    } = get();
    
    if (!editingModel) return;
    
    setIsSavingCollections(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/models/${editingModel.id}/collections`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collections: selectedCollections })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update collections');
      }

      const updatedModel = await response.json();
      setModels(
        models.map(m =>
          m.id === editingModel.id ? { ...m, collections: updatedModel.collections } : m
        )
      );
      setEditingModel(null);
    } catch (error) {
      console.error('Error updating collections:', error);
      alert(error instanceof Error ? error.message : 'Failed to update collections');
    } finally {
      setIsSavingCollections(false);
    }
  },
  
  // New API endpoints
  fetchModelById: async (modelId: string): Promise<Model> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${config.apiUrl}/api/models/${modelId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch model');
      }

      const modelData = await response.json();
      return {
        id: modelData._id,
        name: modelData.name,
        description: modelData.description,
        collections: modelData.collections || [],
        modelType: modelData.modelType,
        department: modelData.department,
        isAgent: modelData.isAgent,
        prompt: modelData.prompt,
        displayRetrievedChunks: modelData.displayRetrievedChunks,
        createdAt: modelData.createdAt,
        updatedAt: modelData.updatedAt,
        createdBy: modelData.createdBy
      };
    } catch (error) {
      console.error('Error fetching model:', error);
      throw error;
    }
  },
  
  updateModel: async (modelId: string, updates: Partial<Model>) => {
    const { setIsUpdating, models, setModels } = get();
    setIsUpdating(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${config.apiUrl}/api/models/${modelId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update model');
      }

      const updatedModel = await response.json();
      const transformedModel: Model = {
        id: updatedModel._id,
        name: updatedModel.name,
        description: updatedModel.description,
        collections: updatedModel.collections || [],
        modelType: updatedModel.modelType,
        department: updatedModel.department,
        isAgent: updatedModel.isAgent,
        prompt: updatedModel.prompt,
        displayRetrievedChunks: updatedModel.displayRetrievedChunks,
        createdAt: updatedModel.createdAt,
        updatedAt: updatedModel.updatedAt,
        createdBy: updatedModel.createdBy
      };

      setModels(models.map(m => m.id === modelId ? transformedModel : m));
    } catch (error) {
      console.error('Error updating model:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  },
  
  bulkDeleteModels: async (modelIds: string[]) => {
    const { setIsBulkDeleting, setBulkActionResults, models, setModels, clearSelection } = get();
    setIsBulkDeleting(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${config.apiUrl}/api/models/bulk`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete models');
      }

      const result = await response.json();
      setBulkActionResults(result);
      
      // Remove successfully deleted models from state
      const deletedIds = result.deletedModels.map((m: any) => m.id);
      setModels(models.filter(m => !deletedIds.includes(m.id)));
      
      clearSelection();
    } catch (error) {
      console.error('Error bulk deleting models:', error);
      setBulkActionResults({ success: 0, errors: [{ error: error instanceof Error ? error.message : 'Unknown error' }] });
    } finally {
      setIsBulkDeleting(false);
    }
  },
  
  searchModels: async (query: string, filters?: any): Promise<Model[]> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const searchParams = new URLSearchParams();
      if (query) searchParams.append('q', query);
      if (filters?.modelType) searchParams.append('modelType', filters.modelType);
      if (filters?.department) searchParams.append('department', filters.department);
      if (filters?.limit) searchParams.append('limit', filters.limit.toString());
      if (filters?.offset) searchParams.append('offset', filters.offset.toString());

      const response = await fetch(`${config.apiUrl}/api/models/search?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to search models');
      }

      const data = await response.json();
      return data.models.map((model: any) => ({
        id: model._id,
        name: model.name,
        description: model.description,
        collections: model.collections || [],
        modelType: model.modelType,
        department: model.department,
        isAgent: model.isAgent,
        prompt: model.prompt,
        displayRetrievedChunks: model.displayRetrievedChunks,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
        createdBy: model.createdBy
      }));
    } catch (error) {
      console.error('Error searching models:', error);
      throw error;
    }
  }
})); 