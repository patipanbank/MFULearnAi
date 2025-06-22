import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';

export interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt: string;
}

interface CollectionStore {
  // State
  collections: Collection[];
  isLoading: boolean;
  lastFetched: number | null;
  error: string | null;

  // Cache settings
  cacheTimeout: number; // milliseconds

  // Actions
  fetchCollections: () => Promise<void>;
  getCollections: () => Promise<Collection[]>;
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  removeCollection: (id: string) => void;
  clearCache: () => void;
}

export const useCollectionStore = create<CollectionStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      collections: [],
      isLoading: false,
      lastFetched: null,
      error: null,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes

      // Actions
      fetchCollections: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get<Collection[]>('/collections');

          if (!response.success || !response.data) {
            throw new Error(`Failed to fetch collections: ${response.error || 'Unknown error'}`);
          }

          set({
            collections: response.data,
            lastFetched: Date.now(),
            isLoading: false,
          });
        } catch (error) {
          console.error('Error fetching collections:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch collections',
            isLoading: false,
          });
        }
      },

      getCollections: async () => {
        const { collections, lastFetched, cacheTimeout, fetchCollections } = get();
        
        // If we have cached data and it's still fresh, return it
        if (collections.length > 0 && lastFetched && Date.now() - lastFetched < cacheTimeout) {
          return collections;
        }

        // Otherwise fetch fresh data
        await fetchCollections();
        return get().collections;
      },

      addCollection: (collection: Collection) => {
        set(state => ({
          collections: [...state.collections, collection],
        }));
      },

      updateCollection: (id: string, updates: Partial<Collection>) => {
        set(state => ({
          collections: state.collections.map(collection =>
            collection.id === id ? { ...collection, ...updates } : collection
          ),
        }));
      },

      removeCollection: (id: string) => {
        set(state => ({
          collections: state.collections.filter(collection => collection.id !== id),
        }));
      },

      clearCache: () => {
        set({
          collections: [],
          lastFetched: null,
        });
      },
    })
  )
); 