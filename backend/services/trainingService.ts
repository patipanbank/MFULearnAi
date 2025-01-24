import { VectorStore } from './vectorStore.js';
import TrainingData from '../models/TrainingData.js';
import logger from './logger.js';
import cache from './cache.js';

export class TrainingService {
  private vectorStore: VectorStore;

  constructor() {
    this.vectorStore = new VectorStore();
  }

  async trainModel(modelName: string, documents: any[], creator: string) {
    try {
      logger.info(`Starting training for ${modelName} by ${creator}`);

      const documentObjects = documents.map((doc, i) => ({
        id: `doc_${Date.now()}_${i}`,
        content: doc.content,
        metadata: {
          creator,
          version: '1.0',
          status: 'active',
          created_at: new Date().toISOString(),
          source: doc.source || 'manual',
          type: doc.type || 'text'
        }
      }));

      // Add to vector store
      await this.vectorStore.addDocuments(modelName, documentObjects);

      // Save to MongoDB
      const trainingData = await TrainingData.create({
        modelName,
        documents: documentObjects,
        creator,
        version: '1.0',
        status: 'active'
      });

      // Invalidate related caches
      await cache.set(`model:${modelName}:updated`, Date.now());

      logger.info(`Training completed for ${modelName}`);
      return trainingData;

    } catch (error) {
      logger.error(`Training failed for ${modelName}:`, error);
      throw error;
    }
  }
} 