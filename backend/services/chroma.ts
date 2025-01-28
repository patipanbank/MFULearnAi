import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
import { ollamaService } from './ollama';
import { EmbeddingService } from './embedding';

interface DocumentMetadata {
  filename: string;
  timestamp: string;
  modelId: string;
  collectionName: string;
  uploadedBy: string;
}

class ChromaService {
  private client: ChromaClient;
  private collections: Map<string, any>;
  private embeddingService: EmbeddingService;
  private processingFiles = new Set<string>();

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || "http://chroma:8000"
    });
    this.collections = new Map();
    this.embeddingService = new EmbeddingService();
  }

  async initCollection(collectionName: string): Promise<any> {
    try {
      if (!this.collections.has(collectionName)) {
        const collection = await this.client.getOrCreateCollection({
          name: collectionName
        });
        this.collections.set(collectionName, collection);
        console.log(`ChromaDB collection ${collectionName} initialized successfully`);
        return collection;
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

  async addDocuments(collectionName: string, documents: string[], metadata: any[]) {
    try {
      // สร้าง collection ถ้ายังไม่มี
      const collection = await this.client.getOrCreateCollection({ name: collectionName });
      
      // สร้าง ids สำหรับแต่ละ document
      const ids = metadata.map(() => crypto.randomUUID());

      // เพิ่มข้อมูล
      await collection.add({
        ids: ids,
        documents: documents,
        metadatas: metadata
      });

    } catch (error) {
      console.error('Error adding documents:', error);
      throw error;
    }
  }

  async queryDocuments(collectionName: string, query: string): Promise<any> {
    try {
      const collection = await this.initCollection(collectionName);
      
      // สร้าง embedding สำหรับ query
      const queryEmbedding = await this.embeddingService.embedText(query);

      // ค้นหาด้วย vector similarity
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 3, // จำนวน results ที่ต้องการ
        include: ["metadatas", "distances", "documents"]
      });

      return results;
    } catch (error) {
      console.error('Error querying documents:', error);
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
}

export const chromaService = new ChromaService(); 