import { create } from 'zustand';
import { api } from '../lib/api';
import type { Collection, Document, SearchContext, SearchResult, QueryAnalysis } from '../types';

// Knowledge Engine - handles document search and management
class KnowledgeEngine {
  // Analyze query to understand intent and extract keywords
  analyzeQuery(query: string): QueryAnalysis {
    const words = query.toLowerCase().split(/\s+/);
    
    // Simple intent detection
    let intent: QueryAnalysis['intent'] = 'search';
    if (words.some(w => ['what', 'how', 'why', 'when', 'where', 'who'].includes(w))) {
      intent = 'question';
    } else if (words.some(w => ['analyze', 'compare', 'evaluate'].includes(w))) {
      intent = 'analysis';
    } else if (words.some(w => ['summary', 'summarize', 'overview'].includes(w))) {
      intent = 'summary';
    }

    // Extract entities and keywords (simplified)
    const entities = words.filter(w => w.charAt(0) === w.charAt(0).toUpperCase());
    const keywords = words.filter(w => w.length > 3 && !['what', 'how', 'why', 'when', 'where', 'who', 'the', 'and', 'that', 'this'].includes(w));

    // Determine complexity
    const complexity: QueryAnalysis['complexity'] = 
      query.length > 100 ? 'complex' : 
      query.length > 30 ? 'moderate' : 
      'simple';

    return {
      intent,
      entities,
      keywords,
      complexity,
      suggestedCollections: [] // Will be populated by ML model
    };
  }

  // Smart search with context awareness
  async search(query: string, context: SearchContext = {}): Promise<SearchResult[]> {
    const analysis = this.analyzeQuery(query);
    
    const searchParams = {
      query,
      analysis,
      context,
      filters: context.filters || {},
      limit: 10
    };

    try {
      const results = await api.post<SearchResult[]>('/search/smart', searchParams);
      
      // Post-process results for better ranking
      return this.rankResults(results, analysis);
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  // Rank search results based on relevance
  private rankResults(results: SearchResult[], analysis: QueryAnalysis): SearchResult[] {
    return results.sort((a, b) => {
      let scoreA = a.score;
      let scoreB = b.score;

      // Boost results that match user intent
      if (analysis.intent === 'question') {
        // Prefer results with question-answer patterns
        if (a.content.includes('?') || a.content.match(/answer|solution|because/i)) {
          scoreA += 0.1;
        }
        if (b.content.includes('?') || b.content.match(/answer|solution|because/i)) {
          scoreB += 0.1;
        }
      }

      // Boost results with keywords
      analysis.keywords.forEach(keyword => {
        if (a.content.toLowerCase().includes(keyword)) scoreA += 0.05;
        if (b.content.toLowerCase().includes(keyword)) scoreB += 0.05;
      });

      return scoreB - scoreA;
    });
  }

  // Get relevant collections based on conversation context
  getRelevantCollections(context: any): Collection[] {
    // Implementation would use ML to suggest relevant collections
    // For now, return all public collections
    return [];
  }

  // Index a new document
  async indexDocument(doc: Document): Promise<void> {
    try {
      await api.post('/documents/index', {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        collectionId: doc.collectionId
      });
    } catch (error) {
      console.error('Failed to index document:', error);
      throw error;
    }
  }

  // Update document index
  async updateIndex(docId: string, content: string): Promise<void> {
    try {
      await api.put(`/documents/${docId}/index`, { content });
    } catch (error) {
      console.error('Failed to update index:', error);
      throw error;
    }
  }
}

// Document Processor - handles file processing
class DocumentProcessor {
  async processFile(file: File, collectionId: string): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('collectionId', collectionId);

    try {
      const processed = await api.post<Document>('/documents/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return processed;
    } catch (error) {
      console.error('Failed to process document:', error);
      throw error;
    }
  }

  async extractMetadata(doc: Document) {
    try {
      const metadata = await api.post('/documents/metadata', {
        content: doc.content,
        type: doc.type
      });
      return metadata;
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      return doc.metadata;
    }
  }
}

// Global instances
export const knowledgeEngine = new KnowledgeEngine();
export const documentProcessor = new DocumentProcessor();

// Knowledge Store
interface KnowledgeState {
  // Data
  collections: Collection[];
  documents: Document[];
  searchResults: SearchResult[];
  
  // UI State
  loading: boolean;
  uploading: boolean;
  error: string | null;
  
  // Actions
  loadCollections: () => Promise<void>;
  createCollection: (data: Omit<Collection, '_id' | 'id' | 'createdAt' | 'updatedAt'>) => Promise<Collection>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  uploadDocuments: (files: File[], collectionId: string) => Promise<Document[]>;
  searchDocuments: (query: string, context?: SearchContext) => Promise<SearchResult[]>;
  deleteDocument: (docId: string) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  // Initial state
  collections: [],
  documents: [],
  searchResults: [],
  loading: false,
  uploading: false,
  error: null,

  // Load collections
  loadCollections: async () => {
    set({ loading: true, error: null });
    try {
      const collections = await api.get<Collection[]>('/collections');
      set({ collections });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load collections' });
    } finally {
      set({ loading: false });
    }
  },

  // Create collection
  createCollection: async (data) => {
    const collection: Collection = {
      ...data,
      _id: `col_${Date.now()}`,
      id: `col_${Date.now()}`,
      documents: [],
      documentCount: 0,
      totalSize: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const created = await api.post<Collection>('/collections', collection);
      set(state => ({ collections: [...state.collections, created] }));
      return created;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create collection');
    }
  },

  // Update collection
  updateCollection: async (id, updates) => {
    try {
      const updated = await api.put<Collection>(`/collections/${id}`, updates);
      set(state => ({
        collections: state.collections.map(c => c._id === id ? updated : c)
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update collection');
    }
  },

  // Delete collection
  deleteCollection: async (id) => {
    try {
      await api.delete(`/collections/${id}`);
      set(state => ({
        collections: state.collections.filter(c => c._id !== id)
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to delete collection');
    }
  },

  // Upload documents
  uploadDocuments: async (files, collectionId) => {
    set({ uploading: true, error: null });
    const uploadedDocs: Document[] = [];

    try {
      for (const file of files) {
        const doc = await documentProcessor.processFile(file, collectionId);
        await knowledgeEngine.indexDocument(doc);
        uploadedDocs.push(doc);
      }

      set(state => ({
        documents: [...state.documents, ...uploadedDocs]
      }));

      return uploadedDocs;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to upload documents' });
      throw error;
    } finally {
      set({ uploading: false });
    }
  },

  // Search documents
  searchDocuments: async (query, context = {}) => {
    set({ loading: true, error: null });
    try {
      const results = await knowledgeEngine.search(query, context);
      set({ searchResults: results });
      return results;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Search failed' });
      return [];
    } finally {
      set({ loading: false });
    }
  },

  // Delete document
  deleteDocument: async (docId) => {
    try {
      await api.delete(`/documents/${docId}`);
      set(state => ({
        documents: state.documents.filter(d => d.id !== docId)
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to delete document');
    }
  }
}));