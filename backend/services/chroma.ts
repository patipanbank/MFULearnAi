import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
import { ollamaService } from './ollama';

interface DocumentMetadata {
  filename: string;
  timestamp: string;
  modelId: string;
  collectionName: string;
  uploadedBy: string;
}

export class ChromaService {
  private client: ChromaClient;
  private collections: Map<string, any> = new Map();
  private processingFiles = new Set<string>();
  private relevanceThreshold = 0.7;

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://chroma:8000'
    });
  }

  async initCollection(collectionName: string): Promise<void> {
    try {
      if (!this.collections.has(collectionName)) {
        const collection = await this.client.getOrCreateCollection({
          name: collectionName
        });
        this.collections.set(collectionName, collection);
        console.log(`ChromaDB collection ${collectionName} initialized successfully`);
      }
    } catch (error) {
      console.error(`Error initializing ChromaDB collection ${collectionName}:`, error);
      throw error;
    }
  }

  async getCollections(): Promise<string[]> {
    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (error) {
      console.error('Error getting collections:', error);
      throw error;
    }
  }

  async addDocuments(collectionName: string, documents: Array<{text: string, metadata: any}>): Promise<void> {
    const fileKey = `${documents[0].metadata.filename}_${documents[0].metadata.uploadedBy}`;
    
    if (this.processingFiles.has(fileKey)) {
      console.log(`File ${fileKey} is already being processed`);
      return;
    }

    this.processingFiles.add(fileKey);
    
    try {
      console.log(`Adding documents to collection ${collectionName}`);
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      
      // สร้าง unique ID สำหรับชุดข้อมูลนี้
      const batchId = `batch_${Date.now()}`;
      
      // เพิ่ม batchId เข้าไปใน metadata
      const docsWithBatchId = documents.map(doc => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          batchId
        }
      }));

      // ตรวจสอบข้อมูลที่มีอยู่
      const existingDocs = await collection.get();
      const existingMetadata = existingDocs.metadatas || [];
      
      // เช็คว่ามีไฟล์นี้อยู่แล้วหรือไม่
      const fileExists = existingMetadata.some((existing: DocumentMetadata) => 
        existing.filename === documents[0].metadata.filename &&
        existing.uploadedBy === documents[0].metadata.uploadedBy
      );

      if (fileExists) {
        console.log(`File ${documents[0].metadata.filename} already exists, skipping upload`);
        return;
      }

      // ถ้าไม่มีข้อมูลซ้ำ ให้เพิ่มข้อมูลใหม่
      console.log(`Adding ${docsWithBatchId.length} new documents`);
      const ids = docsWithBatchId.map((_, i) => `${batchId}_${i}`);
      const texts = docsWithBatchId.map(doc => doc.text);
      const metadatas = docsWithBatchId.map(doc => doc.metadata);

      await collection.add({
        ids,
        documents: texts,
        metadatas
      });
      
      console.log('Documents added successfully');
    } finally {
      this.processingFiles.delete(fileKey);
    }
  }

  async queryDocuments(collectionName: string, query: string, n_results: number = 5) {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      const results = await collection.query({
        queryTexts: [query],
        nResults: n_results
      });
      return results;
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      throw error;
    }
  }

  async queryCollection(collectionName: string, text: string, nResults: number = 5) {
    await this.initCollection(collectionName);
    const collection = this.collections.get(collectionName);
    return collection.query({
      queryTexts: [text],
      nResults: nResults
    });
  }

  async query(collectionName: string, text: string): Promise<any[]> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      const results = await collection.query({
        queryTexts: [text],
        nResults: 1,
        include: ["metadatas", "distances", "documents"]
      });

      return results.documents[0].map((doc: string, index: number) => ({
        text: doc,
        metadata: results.metadatas[0][index],
        score: results.distances ? 1 - (results.distances[0][index] || 0) : 0
      }));
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      return [];
    }
  }

  async getAllDocuments(collectionName: string): Promise<{
    ids: string[];
    documents: string[];
    metadatas: Record<string, any>[];
  }> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      const results = await collection.get();
      return {
        ids: results.ids || [],
        documents: results.documents || [],
        metadatas: results.metadatas || []
      };
    } catch (error) {
      console.error('Error fetching documents from ChromaDB:', error);
      throw error;
    }
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection ${collectionName} not found`);
      }

      console.log(`Deleting document ${id} from collection ${collectionName}`);
      await collection.delete({
        ids: [id]
      });
      console.log('Document deleted successfully');
    } catch (error) {
      console.error(`Error deleting document from ChromaDB:`, error);
      throw error;
    }
  }

  async deleteDocumentsWithoutModelOrCollection(): Promise<void> {
    try {
      const collections = await this.getCollections();
      
      for (const collectionName of collections) {
        await this.initCollection(collectionName);
        const collection = this.collections.get(collectionName);
        const results = await collection.get();
        
        if (results && results.ids) {
          for (let i = 0; i < results.ids.length; i++) {
            const metadata = results.metadatas?.[i] || {};
            if (!metadata.modelId || !metadata.collectionName) {
              await collection.delete({ ids: [results.ids[i]] });
              console.log(`Deleted document ${results.ids[i]} without model/collection info`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up documents:', error);
      throw error;
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    try {
      await this.client.deleteCollection({
        name: collectionName
      });
      this.collections.delete(collectionName);
    } catch (error) {
      console.error(`Error deleting collection ${collectionName}:`, error);
      throw error;
    }
  }

  async semanticSearch(query: string, collectionName: string) {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      return await collection.query({
        queryTexts: [query],
        nResults: 5
      });
    } catch (error) {
      console.error('Semantic search error:', error);
      return null;
    }
  }

  async keywordSearch(query: string, collectionName: string) {
    try {
      const keywords = query.toLowerCase().split(' ');
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      return await collection.query({
        queryTexts: keywords,
        nResults: 5
      });
    } catch (error) {
      console.error('Keyword search error:', error);
      return null;
    }
  }

  async hybridSearch(query: string, collectionName: string) {
    try {
      const semanticResults = await this.semanticSearch(query, collectionName);
      const keywordResults = await this.keywordSearch(query, collectionName);

      if (!semanticResults || !keywordResults) {
        // fallback to original search
        return this.queryDocuments(collectionName, query);
      }

      // Combine and re-rank results
      const combinedResults = this.combineSearchResults(semanticResults, keywordResults);
      return combinedResults.filter((result: { similarity: number }) => result.similarity > this.relevanceThreshold);
    } catch (error) {
      console.error('Hybrid search error:', error);
      // fallback to original search  
      return this.queryDocuments(collectionName, query);
    }
  }

  private combineSearchResults(semantic: any, keyword: any) {
    // ... implement result combination logic ...
    return semantic; // temporary fallback
  }

  async checkHashExists(hash: string): Promise<boolean> {
    // ... implement hash checking logic ...
    return false; // temporary fallback
  }
}

export const chromaService = new ChromaService(); 