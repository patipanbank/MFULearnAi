import { ChromaClient, Collection } from 'chromadb';
import { pipeline } from '@xenova/transformers';
import { Document } from '@langchain/core/documents';
import type { TrainingData } from '../models/TrainingData.js';

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private encoder: any;

  constructor() {
    this.client = new ChromaClient();
    this.initializeStore();
  }

  private async initializeStore() {
    try {
      // สร้าง collection สำหรับเก็บ vectors
      this.collection = await this.client.createCollection({
        name: "mfu_knowledge_base",
        metadata: { "description": "MFU knowledge base vectors" }
      });

      // โหลด encoder model
      this.encoder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (error) {
      console.error('Error initializing vector store:', error);
      throw error;
    }
  }

  async addDocument(document: TrainingData) {
    try {
      if (!this.collection) {
        throw new Error('Collection not initialized');
      }
      
      // แปลงข้อความเป็น vector
      const embedding = await this.encoder(document.content);
      
      // เพิ่มลงใน collection
      await this.collection.add({
        ids: [(document as any)._id.toString()],
        embeddings: embedding.tolist(),
        metadatas: [{
          source: document.name,
          author: document.createdBy.username,
          timestamp: document.createdAt.toISOString()
        }],
        documents: [document.content]
      });
    } catch (error) {
      console.error('Error adding document to vector store:', error);
      throw error;
    }
  }

  async querySimular(query: string, limit: number = 5) {
    try {
      if (!this.collection) {
        throw new Error('Collection not initialized');
      }
      
      // แปลง query เป็น vector
      const queryEmbedding = await this.encoder(query);
      
      // ค้นหาเอกสารที่เกี่ยวข้อง
      const results = await this.collection.query({
        queryEmbeddings: queryEmbedding.tolist(),
        nResults: limit
      });

      return results;
    } catch (error) {
      console.error('Error querying vector store:', error);
      throw error;
    }
  }
}

export const vectorStore = new VectorStore(); 