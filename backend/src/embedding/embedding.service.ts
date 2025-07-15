import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService } from '../services/chroma.service';

export interface CreateEmbeddingDto {
  text: string;
  modelId?: string;
}

export interface BatchEmbeddingDto {
  texts: string[];
  modelId?: string;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private bedrockService: BedrockService,
    private chromaService: ChromaService,
  ) {}

  async createEmbedding(text: string, modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    try {
      this.logger.log(`Creating embedding for text with model: ${modelId}`);
      const embedding = await this.bedrockService.createTextEmbedding(text);
      return embedding;
    } catch (error) {
      this.logger.error(`Error creating embedding: ${error}`);
      throw new Error(`Failed to create embedding: ${error.message}`);
    }
  }

  async createBatchEmbeddings(
    texts: string[],
    modelId: string = 'amazon.titan-embed-text-v1',
  ): Promise<number[][]> {
    try {
      this.logger.log(`Creating batch embeddings for ${texts.length} texts with model: ${modelId}`);
      const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
      return embeddings;
    } catch (error) {
      this.logger.error(`Error creating batch embeddings: ${error}`);
      throw new Error(`Failed to create batch embeddings: ${error.message}`);
    }
  }

  async createImageEmbedding(
    imageBase64: string,
    text?: string,
    modelId: string = 'amazon.titan-embed-image-v1',
  ): Promise<number[]> {
    try {
      this.logger.log(`Creating image embedding with model: ${modelId}`);
      const embedding = await this.bedrockService.createImageEmbedding(imageBase64, text);
      return embedding;
    } catch (error) {
      this.logger.error(`Error creating image embedding: ${error}`);
      throw new Error(`Failed to create image embedding: ${error.message}`);
    }
  }

  async querySimilarDocuments(
    collectionName: string,
    queryText: string,
    nResults: number = 5,
    modelId: string = 'amazon.titan-embed-text-v1',
  ): Promise<any> {
    try {
      this.logger.log(`Querying similar documents in collection: ${collectionName}`);
      
      // Create embedding for query text
      const queryEmbedding = await this.createEmbedding(queryText, modelId);
      
      // Query ChromaDB
      const results = await this.chromaService.queryCollection(
        collectionName,
        [queryEmbedding],
        nResults,
      );

      return results;
    } catch (error) {
      this.logger.error(`Error querying similar documents: ${error}`);
      throw new Error(`Failed to query similar documents: ${error.message}`);
    }
  }

  async addDocumentsToCollection(
    collectionName: string,
    documents: Array<{ text: string; metadata?: any; id?: string }>,
    modelId: string = 'amazon.titan-embed-text-v1',
  ): Promise<void> {
    try {
      this.logger.log(`Adding ${documents.length} documents to collection: ${collectionName}`);
      
      // Create embeddings for all documents
      const texts = documents.map(doc => doc.text);
      const embeddings = await this.createBatchEmbeddings(texts, modelId);
      
      // Prepare documents for ChromaDB
      const chromaDocuments = documents.map((doc, index) => ({
        id: doc.id || `doc_${Date.now()}_${index}`,
        document: doc.text,
        metadata: doc.metadata || {},
        embedding: embeddings[index],
      }));

      // Add to ChromaDB
      await this.chromaService.addDocuments(collectionName, chromaDocuments);
      
      this.logger.log(`Successfully added ${documents.length} documents to collection: ${collectionName}`);
    } catch (error) {
      this.logger.error(`Error adding documents to collection: ${error}`);
      throw new Error(`Failed to add documents to collection: ${error.message}`);
    }
  }

  async getModelDimension(modelId: string): Promise<number> {
    return this.bedrockService.getModelDimension(modelId);
  }

  async validateEmbedding(embedding: number[]): Promise<boolean> {
    try {
      if (!Array.isArray(embedding)) {
        return false;
      }

      if (embedding.length === 0) {
        return false;
      }

      // Check if all elements are numbers
      return embedding.every(val => typeof val === 'number' && !isNaN(val));
    } catch (error) {
      this.logger.error(`Error validating embedding: ${error}`);
      return false;
    }
  }

  async compareEmbeddings(embedding1: number[], embedding2: number[]): Promise<number> {
    try {
      if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same dimension');
      }

      // Calculate cosine similarity
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
      }

      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      return similarity;
    } catch (error) {
      this.logger.error(`Error comparing embeddings: ${error}`);
      throw new Error(`Failed to compare embeddings: ${error.message}`);
    }
  }
} 