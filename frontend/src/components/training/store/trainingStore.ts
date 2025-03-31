import { create } from 'zustand';
import { config } from '../../../config/config';
import { CollectionExtended, CollectionPermission, MongoFile, UploadedFile, UserInfo } from '../utils/types';

interface TrainingState {
  // Collections state
  collections: CollectionExtended[];
  isLoading: boolean;
  isUploading: boolean;
  userInfo: UserInfo | null;
  uploadedFiles: UploadedFile[];
  
  // Basic actions
  setCollections: (collections: CollectionExtended[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsUploading: (isUploading: boolean) => void;
  setUserInfo: (userInfo: UserInfo | null) => void;
  setUploadedFiles: (files: UploadedFile[]) => void;
  
  // Thunks
  fetchUserInfo: () => Promise<void>;
  fetchCollections: () => Promise<void>;
  fetchCollectionFiles: (collectionId: string) => Promise<void>;
  
  // Collection CRUD operations
  handleCreateCollection: (name: string, isPrivate: boolean) => Promise<void>;
  handleUpdateCollection: (collectionId: string, updates: { name?: string; permission?: CollectionPermission }) => Promise<void>;
  handleDeleteCollection: (collectionId: string) => Promise<void>;
  
  // File operations
  handleUploadFile: (collectionId: string, file: File) => Promise<void>;
  handleDeleteFile: (collectionId: string, fileId: string) => Promise<void>;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  // Initial state
  collections: [],
  isLoading: true,
  isUploading: false,
  userInfo: null,
  uploadedFiles: [],
  
  // Basic setters
  setCollections: (collections) => set({ collections }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsUploading: (isUploading) => set({ isUploading }),
  setUserInfo: (userInfo) => set({ userInfo }),
  setUploadedFiles: (uploadedFiles) => set({ uploadedFiles }),
  
  // Thunks
  fetchUserInfo: async () => {
    try {
      const userDataStr = localStorage.getItem('user_data');
      if (!userDataStr) {
        throw new Error('No user data found');
      }
      const userData = JSON.parse(userDataStr);
      set({ userInfo: userData });
    } catch (error) {
      console.error('Error getting user info:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchCollections: async () => {
    const { setCollections } = get();
    
    try {
      set({ isLoading: true });
      
      const token = localStorage.getItem('auth_token');
      const { userInfo } = get();
      
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch collections');
      
      const data = await response.json();
      
      // Transform collection data
      let transformedCollections: CollectionExtended[] = data.map((mongo: any) => ({
        id: mongo._id?.toString() || mongo.id || 'unknown',
        name: mongo.name || '',
        createdBy: mongo.createdBy || 'Unknown',
        created: mongo.created || mongo.createdAt || new Date().toISOString(),
        permission: mongo.permission || CollectionPermission.PUBLIC,
        lastModified: mongo.lastModified || mongo.updatedAt || mongo.created || new Date().toISOString(),
        documentCount: mongo.documentCount || 0,
        isPrivate: mongo.permission === CollectionPermission.PRIVATE || 
                  (Array.isArray(mongo.permission) && mongo.permission.length > 0)
      }));
      
      // Filter collections based on user role and permissions
      if (userInfo) {
        // All collections (public and private) are only visible to their creators
        transformedCollections = transformedCollections.filter(collection => 
          collection.createdBy === (userInfo.nameID || userInfo.name) // Use nameID as primary identifier
        );
      }
      
      setCollections(transformedCollections);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchCollectionFiles: async (collectionId: string) => {
    try {
      const { collections } = get();
      const collection = collections.find(c => c.id === collectionId);
      
      if (!collection) {
        throw new Error('Collection not found');
      }
      
      const response = await fetch(
        `${config.apiUrl}/api/training/documents?collectionName=${encodeURIComponent(collection.name)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const mongoFiles: MongoFile[] = await response.json();
      
      // Transform MongoFile[] to UploadedFile[]
      const transformedFiles: UploadedFile[] = mongoFiles.map(file => ({
        id: Math.random().toString(36).substring(2, 9), // Generate a random ID for now
        filename: file.filename,
        collectionId: collectionId,
        uploadedBy: file.uploadedBy || 'Unknown',
        timestamp: file.timestamp || new Date().toISOString(),
        ids: file.ids || []
      }));
      
      // Update the collection's document count to match actual file count
      set(state => ({
        uploadedFiles: transformedFiles,
        collections: state.collections.map(c => 
          c.id === collectionId 
            ? { ...c, documentCount: mongoFiles.length } 
            : c
        )
      }));
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
    }
  },
  
  handleCreateCollection: async (name: string, isPrivate: boolean) => {
    try {
      set({ isLoading: true });
      
      const token = localStorage.getItem('auth_token');
      const { userInfo } = get();
      
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          permission: isPrivate ? CollectionPermission.PRIVATE : CollectionPermission.PUBLIC,
          createdBy: userInfo?.nameID || userInfo?.name || 'Unknown', // Use nameID as primary identifier
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create collection');
      }
      
      // Refresh collections after creating a new one
      get().fetchCollections();
    } catch (error) {
      console.error('Error creating collection:', error);
      set({ isLoading: false });
    }
  },
  
  handleUpdateCollection: async (collectionId: string, updates: { name?: string; permission?: CollectionPermission }) => {
    try {
      set({ isLoading: true });
      
      const token = localStorage.getItem('auth_token');
      const { collections } = get();
      
      const collection = collections.find(c => c.id === collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }
      
      const response = await fetch(`${config.apiUrl}/api/training/collections/${collectionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update collection');
      }
      
      // Update local state with new collection data
      set(state => ({
        collections: state.collections.map(c => 
          c.id === collectionId 
            ? { 
                ...c, 
                ...updates, 
                lastModified: new Date().toISOString(),
                isPrivate: updates.permission === CollectionPermission.PRIVATE
              } 
            : c
        )
      }));
    } catch (error) {
      console.error('Error updating collection:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  handleDeleteCollection: async (collectionId: string) => {
    try {
      set({ isLoading: true });
      
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.apiUrl}/api/training/collections/${collectionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete collection');
      }
      
      // Update local state
      set(state => ({
        collections: state.collections.filter(c => c.id !== collectionId),
        uploadedFiles: state.uploadedFiles.filter(f => f.collectionId !== collectionId)
      }));
    } catch (error) {
      console.error('Error deleting collection:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  handleUploadFile: async (collectionId: string, file: File) => {
    try {
      set({ isUploading: true });
      
      const token = localStorage.getItem('auth_token');
      const { collections, userInfo } = get();
      
      const collection = collections.find(c => c.id === collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collectionName', collection.name);
      
      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const result = await response.json();
      
      // Add the new file to the list of uploaded files
      set(state => ({
        uploadedFiles: [
          ...state.uploadedFiles,
          {
            id: Math.random().toString(36).substring(2, 9), // Generate random ID
            filename: file.name,
            collectionId: collectionId,
            uploadedBy: userInfo?.name || 'Unknown',
            timestamp: new Date().toISOString(),
            ids: result.ids || []
          }
        ],
        // Update document count
        collections: state.collections.map(c => 
          c.id === collectionId 
            ? { ...c, documentCount: (c.documentCount || 0) + 1 } 
            : c
        )
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      set({ isUploading: false });
    }
  },
  
  handleDeleteFile: async (collectionId: string, fileId: string) => {
    try {
      set({ isLoading: true });
      
      const token = localStorage.getItem('auth_token');
      const { uploadedFiles, collections } = get();
      
      const fileToDelete = uploadedFiles.find(f => f.id === fileId);
      if (!fileToDelete) {
        throw new Error('File not found');
      }
      
      const collection = collections.find(c => c.id === collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }
      
      // Use the correct endpoint and method for document deletion
      // The backend expects document IDs, not just filename
      if (fileToDelete.ids && fileToDelete.ids.length > 0) {
        // Delete each document ID associated with the file
        const deletePromises = fileToDelete.ids.map(docId => 
          fetch(`${config.apiUrl}/api/training/documents/${docId}?collectionName=${encodeURIComponent(collection.name)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          })
        );
        
        await Promise.all(deletePromises);
      } else {
        // Fallback if we don't have document IDs (less reliable)
        const response = await fetch(`${config.apiUrl}/api/training/documents`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: fileToDelete.filename,
            collectionName: collection.name,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete file');
        }
      }
      
      // Update local state
      set(state => ({
        uploadedFiles: state.uploadedFiles.filter(f => f.id !== fileId),
        // Update document count
        collections: state.collections.map(c => 
          c.id === collectionId 
            ? { ...c, documentCount: Math.max(0, (c.documentCount || 0) - 1) } 
            : c
        )
      }));
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      set({ isLoading: false });
    }
  },
})); 