import { create } from 'zustand';

export interface Model {
  id: string;
  name: string;
  collections: string[];
  createdBy: string;
  modelType: 'official' | 'personal' | 'department';
  department?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt: string;
}

interface ModelsState {
  // Models
  models: Model[];
  setModels: (models: Model[]) => void;
  selectedModel: Model | null;
  setSelectedModel: (model: Model | null) => void;
  
  // Collections
  collections: Collection[];
  setCollections: (collections: Collection[]) => void;
  selectedCollections: string[];
  setSelectedCollections: (collections: string[]) => void;
  toggleCollection: (collectionId: string) => void;
  
  // Loading states
  modelsLoading: boolean;
  collectionsLoading: boolean;
  setModelsLoading: (loading: boolean) => void;
  setCollectionsLoading: (loading: boolean) => void;
  
  // API actions
  fetchModels: () => Promise<void>;
  fetchCollections: () => Promise<void>;
  createModel: (modelData: Partial<Model>) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  // Models
  models: [],
  setModels: (models) => set({ models }),
  selectedModel: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
  
  // Collections
  collections: [],
  setCollections: (collections) => set({ collections }),
  selectedCollections: [],
  setSelectedCollections: (collections) => set({ selectedCollections: collections }),
  toggleCollection: (collectionId) => set((state) => {
    const isSelected = state.selectedCollections.includes(collectionId);
    return {
      selectedCollections: isSelected
        ? state.selectedCollections.filter(id => id !== collectionId)
        : [...state.selectedCollections, collectionId]
    };
  }),
  
  // Loading states
  modelsLoading: false,
  collectionsLoading: false,
  setModelsLoading: (loading) => set({ modelsLoading: loading }),
  setCollectionsLoading: (loading) => set({ collectionsLoading: loading }),
  
  // API actions
  fetchModels: async () => {
    set({ modelsLoading: true });
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/models', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const models = await response.json();
        set({ models });
        
        // Auto-select first model if none selected
        const { selectedModel } = get();
        if (!selectedModel && models.length > 0) {
          set({ selectedModel: models[0] });
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      set({ modelsLoading: false });
    }
  },
  
  fetchCollections: async () => {
    set({ collectionsLoading: true });
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/collections', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const collections = await response.json();
        set({ collections });
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      set({ collectionsLoading: false });
    }
  },
  
  createModel: async (modelData) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelData)
      });
      
      if (response.ok) {
        const newModel = await response.json();
        set((state) => ({
          models: [...state.models, newModel]
        }));
      }
    } catch (error) {
      console.error('Failed to create model:', error);
      throw error;
    }
  },
  
  deleteModel: async (modelId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        set((state) => ({
          models: state.models.filter(model => model.id !== modelId),
          selectedModel: state.selectedModel?.id === modelId ? null : state.selectedModel
        }));
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      throw error;
    }
  }
}));

export default useModelsStore; 