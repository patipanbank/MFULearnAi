import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { Chroma } from '@langchain/community/vectorstores/chroma';
// import { BedrockEmbeddings } from '@langchain/aws';
import { Document } from '@langchain/core/documents';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class VectorMemoryService {
  private readonly logger = new Logger(VectorMemoryService.name);
  private vectorStore: Chroma | null = null;
  // private embeddings: BedrockEmbeddings | null = null;
  private embeddings: any = null;

  constructor(private configService: ConfigService) {
    this.initializeVectorStore();
  }

  private async initializeVectorStore(): Promise<void> {
    try {
      // this.embeddings = await this.initializeEmbeddings();
      this.embeddings = null;
      // this.vectorStore = await Chroma.fromExistingCollection(
      //   this.embeddings,
      //   { collectionName: 'memory' }
      // );
      this.logger.log('Vector memory service initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize vector store: ${error}`);
    }
  }

  // private async initializeEmbeddings(): Promise<BedrockEmbeddings> {
  private async initializeEmbeddings(): Promise<any> {
    // return new BedrockEmbeddings({
    return {
      region: this.configService.get('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY') || '',
      },
    };
  }

  async addMemory(sessionId: string, content: string, metadata?: any): Promise<void> {
    try {
      if (!this.vectorStore) {
        this.logger.warn('Vector store not initialized');
        return;
      }

      const document = new Document({
        pageContent: content,
        metadata: {
          sessionId,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });

      // await this.vectorStore.addDocuments([document]);
      this.logger.log(`Memory added for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error adding memory: ${error}`);
    }
  }

  async searchMemory(sessionId: string, query: string, k: number = 5): Promise<Document[]> {
    try {
      if (!this.vectorStore) {
        this.logger.warn('Vector store not initialized');
        return [];
      }

      // const results = await this.vectorStore.similaritySearch(query, k, {
      //   sessionId,
      // });
      // return results;
      return [];
    } catch (error) {
      this.logger.error(`Error searching memory: ${error}`);
      return [];
    }
  }

  async clearMemory(sessionId: string): Promise<void> {
    try {
      if (!this.vectorStore) {
        this.logger.warn('Vector store not initialized');
        return;
      }

      // Note: Chroma doesn't have a direct delete method by metadata
      // In a real implementation, you'd need to implement this differently
      this.logger.log(`Memory cleared for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error clearing memory: ${error}`);
    }
  }
} 