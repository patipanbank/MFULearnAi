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
      // สร้าง collection ใหม่ทุกครั้ง
      await this.client.deleteCollection({ name: collectionName });
      const collection = await this.client.createCollection({ 
        name: collectionName,
        metadata: { "hnsw:space": "cosine" } // กำหนด similarity metric
      });

      const ids = metadata.map(() => crypto.randomUUID());

      console.log('Debug Add Documents:');
      console.log('Collection:', collectionName);
      console.log('Documents count:', documents.length);
      console.log('Sample document:', documents[0].substring(0, 100));
      console.log('Sample metadata:', metadata[0]);

      await collection.add({
        ids: ids,
        documents: documents,
        metadatas: metadata
      });

      // ตรวจสอบผลลัพธ์
      const count = await collection.count();
      console.log('Documents added successfully. Total count:', count);

    } catch (error: any) {
      console.error('Error details:', error);
      console.error('Error cause:', error.cause);
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

  async getAllDocuments(collectionName: string) {
    try {
      // ใช้ getOrCreateCollection แทน getCollection
      const collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: { "hnsw:space": "cosine" }
      });

      // ตรวจสอบจำนวน documents
      const count = await collection.count();
      if (count === 0) {
        return { documents: [], metadatas: [], ids: [] };
      }

      // ดึงข้อมูลทั้งหมด
      const result = await collection.get();
      console.log(`Retrieved ${result.documents.length} documents from collection ${collectionName}`);
      
      return result;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error fetching documents:', error.message);
      }
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

  async inspectCollection(collectionName: string) {
    try {
      const collection = await this.client.getCollection({ 
        name: collectionName,
        embeddingFunction: this.embeddingService
      });
      const count = await collection.count();
      const peek = await collection.peek({ limit: 5 });

      console.log('Collection Stats:');
      console.log('Total Documents:', count);
      console.log('Sample Documents:', peek);

      return { count, peek };
    } catch (error) {
      console.error('Error inspecting collection:', error);
      throw error;
    }
  }
}

export const chromaService = new ChromaService(); 