import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  documents?: Document[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeStore {
  collections: Collection[];
  selectedCollection: Collection | null;
  isLoading: boolean;
  fetchCollections: () => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  uploadDocument: (collectionId: string, file: File) => Promise<void>;
  deleteDocument: (collectionId: string, documentId: string) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeStore>()(
  devtools((set) => ({
    collections: [],
    selectedCollection: null,
    isLoading: false,
    fetchCollections: async () => {
      set({ isLoading: true });
      try {
        const collections = await api.get<Collection[]>('/collections/');
        set({ collections, isLoading: false });
      } catch (error) {
        console.error('Failed to fetch collections:', error);
        set({ isLoading: false });
      }
    },
    createCollection: async (name) => {
      const newCollection = await api.post<Collection>('/collections/', { name });
      set((state) => ({ collections: [...state.collections, newCollection] }));
    },
    deleteCollection: async (id) => {
      await api.delete(`/collections/${id}`);
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== id)
      }));
    },
    uploadDocument: async (collectionId, file) => {
      const formData = new FormData();
      formData.append('file', file);
      const document = await api.post<Document>(
        `/collections/${collectionId}/documents`,
        formData
      );
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === collectionId
            ? { ...c, documents: [...(c.documents || []), document] }
            : c
        )
      }));
    },
    deleteDocument: async (collectionId, documentId) => {
      await api.delete(`/collections/${collectionId}/documents/${documentId}`);
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                documents: c.documents?.filter((d) => d.id !== documentId)
              }
            : c
        )
      }));
    }
  }))
);

export default useKnowledgeStore; 