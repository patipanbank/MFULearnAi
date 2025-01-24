import { ChromaClient, Collection } from 'chromadb';
import { pipeline } from '@xenova/transformers';
import logger from './logger.js';
import cache from './cache.js';

export class VectorStore {
  private client: ChromaClient;
  private embedder: any;
  
  constructor() {
    this.client = new ChromaClient();
    this.initEmbedder();
  }

  private async initEmbedder() {
    try {
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );
    } catch (error) {
      logger.error('Embedder initialization failed:', error);
      throw error;
    }
  }

  async createCollection(modelName: string) {
    try {
      return await this.client.createCollection({
        name: modelName,
        metadata: {
          "description": `Vector store for ${modelName}`,
          "version": "1.0",
          "created_at": new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Failed to create collection ${modelName}:`, error);
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]) {
    try {
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          const cacheKey = `embedding:${text}`;
          const cached = await cache.get(cacheKey);
          
          if (cached) return cached;

          const embedding = await this.embedder(text);
          await cache.set(cacheKey, embedding);
          return embedding;
        })
      );
      return embeddings;
    } catch (error) {
      logger.error('Embedding generation failed:', error);
      throw error;
    }
  }

  async addDocuments(modelName: string, documents: any[]) {
    try {
      const collection = await this.client.getCollection({
        name: modelName,
        embeddingFunction: this.embedder
      });
      
      const embeddings = await this.generateEmbeddings(
        documents.map(d => d.content)
      );

      await collection.add({
        ids: documents.map(d => d.id),
        embeddings,
        metadatas: documents.map(d => ({
          ...d.metadata,
          updated_at: new Date().toISOString()
        })),
        documents: documents.map(d => d.content)
      });

      logger.info(`Added ${documents.length} documents to ${modelName}`);
    } catch (error) {
      logger.error(`Failed to add documents to ${modelName}:`, error);
      throw error;
    }
  }

  async getCollection(modelName: string) {
    try {
      return await this.client.getCollection({
        name: modelName,
        embeddingFunction: this.embedder
      });
    } catch (error) {
      logger.error(`Failed to get collection ${modelName}:`, error);
      throw error;
    }
  }
} 