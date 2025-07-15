import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService, ChromaDocument } from '../collection/chroma.service';

export interface MemoryDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity?: number;
}

export interface SearchResult {
  documents: MemoryDocument[];
  query: string;
  totalResults: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

@Injectable()
export class MemoryToolService {
  private readonly logger = new Logger(MemoryToolService.name);
  private readonly MAX_DOCUMENTS_PER_COLLECTION = 1000; // Prevent memory bloat
  private readonly EMBED_THRESHOLD = 10; // Embed every 10 messages like FastAPI
  private vectorStores: Map<string, any> = new Map(); // Store Chroma vector stores by session
  
  constructor(
    private configService: ConfigService,
    private bedrockService: BedrockService,
    private chromaService: ChromaService,
  ) {}

  /**
   * Check if messages should be embedded (every 10 messages like FastAPI)
   */
  shouldEmbedMessages(messageCount: number): boolean {
    return messageCount > 0 && messageCount % this.EMBED_THRESHOLD === 0;
  }

  /**
   * Add chat memory to vector store (like FastAPI ChatMemoryTool.add_chat_memory)
   */
  async addChatMemory(chatId: string, messages: ChatMessage[]): Promise<void> {
    try {
      this.logger.log(`📚 Adding chat memory for ${chatId}, ${messages.length} messages`);

      // Get existing message IDs to avoid duplicates
      const existingIds = new Set<string>();
      if (this.vectorStores.has(chatId)) {
        try {
          const existingDocs = await this.chromaService.getDocuments(`chat_memory_${chatId}`);
          if (existingDocs.documents) {
            for (const doc of existingDocs.documents) {
              if (doc.metadata?.message_id) {
                existingIds.add(doc.metadata.message_id);
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Could not check existing messages: ${error.message}`);
        }
      }

      // Create documents from new messages only
      const documentsToAdd: ChromaDocument[] = [];
      let newMessageCount = 0;

      for (const msg of messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const content = msg.content?.trim();
          const messageId = msg.id;

          // Skip if message already exists
          if (existingIds.has(messageId) || !content) {
            continue;
          }

          // Create embedding for the message
          const embedding = await this.bedrockService.createTextEmbedding(content);
          if (!embedding || embedding.length === 0) {
            continue;
          }

          documentsToAdd.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            document: content,
            metadata: {
              session_id: chatId,
              role: msg.role,
              timestamp: msg.timestamp || new Date().toISOString(),
              message_id: messageId,
            },
            embedding: embedding,
          });

          newMessageCount++;
        }
      }

      if (documentsToAdd.length > 0) {
        // Add to ChromaDB collection
        await this.chromaService.addDocuments(`chat_memory_${chatId}`, documentsToAdd);
        this.logger.log(`📚 Added ${newMessageCount} new messages to memory for session ${chatId}`);
      } else {
        this.logger.log(`📚 No new messages to add for session ${chatId}`);
      }

    } catch (error) {
      this.logger.error(`Failed to add chat memory for ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Clear specific chat memory (like FastAPI ChatMemoryTool.clear_chat_memory)
   */
  async clearChatMemory(chatId: string): Promise<void> {
    try {
      this.logger.log(`🧹 Clearing memory for chat ${chatId}`);

      // Delete the collection from ChromaDB
      await this.chromaService.deleteCollection(`chat_memory_${chatId}`);
      
      // Remove from local cache
      this.vectorStores.delete(chatId);
      
      this.logger.log(`🧹 Cleared chat memory for session ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to clear chat memory for ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Search memory for relevant context (like FastAPI ChatMemoryTool.search_chat_memory)
   */
  async searchMemory(
    query: string,
    collectionName: string,
    limit: number = 5,
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<SearchResult> {
    try {
      this.logger.log(`🔍 Searching memory for query: "${query}" in collection: ${collectionName}`);

      // Create embedding for the query
      const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return {
          documents: [],
          query,
          totalResults: 0
        };
      }

      // Search in ChromaDB
      const results = await this.chromaService.queryCollection(
        collectionName,
        queryEmbedding,
        limit
      );

      if (!results) {
        return {
          documents: [],
          query,
          totalResults: 0
        };
      }

      // Format results
      const documents: MemoryDocument[] = [];
      if (results.documents && results.documents.length > 0) {
        for (let i = 0; i < results.documents.length; i++) {
          const doc = results.documents[i];
          const metadata = results.metadatas?.[i] || {};
          const distance = results.distances?.[i] || 0;

          documents.push({
            id: results.ids?.[i] || `doc_${i}`,
            content: doc,
            metadata: metadata,
            similarity: 1 - distance, // Convert distance to similarity
          });
        }
      }

      return {
        documents,
        query,
        totalResults: documents.length
      };

    } catch (error) {
      this.logger.error('Error searching memory:', error);
      return {
        documents: [],
        query,
        totalResults: 0
      };
    }
  }

  /**
   * Add content to memory collection (like FastAPI add_to_memory)
   */
  async addToMemory(
    content: string,
    collectionName: string,
    metadata: Record<string, any> = {},
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean; documentId: string }> {
    try {
      this.logger.log(`📚 Adding content to memory collection: ${collectionName}`);

      // Create embedding for the content
      const embedding = await this.bedrockService.createTextEmbedding(content);
      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to create embedding for content');
      }

      const documentId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      const documentToAdd: ChromaDocument[] = [{
        id: documentId,
        document: content,
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
          model_id: modelId,
        },
        embedding: embedding,
      }];

      await this.chromaService.addDocuments(collectionName, documentToAdd);
      
      return { success: true, documentId };
    } catch (error) {
      this.logger.error('Error adding to memory:', error);
      throw error;
    }
  }

  /**
   * Remove document from memory collection
   */
  async removeFromMemory(
    documentId: string,
    collectionName: string
  ): Promise<{ success: boolean }> {
    try {
      this.logger.log(`🗑️ Removed document ${documentId} from collection: ${collectionName}`);
      
      await this.chromaService.deleteDocuments(collectionName, [documentId]);
      return { success: true };
    } catch (error) {
      this.logger.error('Error removing from memory:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics (like FastAPI ChatMemoryTool.get_memory_stats)
   */
  async getMemoryStats(collectionName?: string): Promise<{
    totalDocuments: number;
    totalSessions: number;
    totalMessages: number;
    collectionName?: string;
    status: string;
  }> {
    try {
      this.logger.log(`📊 Getting memory stats for collection: ${collectionName || 'all'}`);

      if (collectionName) {
        // Get stats for specific collection
        const docs = await this.chromaService.getDocuments(collectionName);
        return {
          totalDocuments: docs.total || 0,
          totalSessions: 1,
          totalMessages: docs.total || 0,
          collectionName,
          status: 'ready'
        };
      } else {
        // Get stats for all collections
        const collections = await this.chromaService.listCollections();
        let totalDocuments = 0;
        let totalSessions = 0;

        for (const collection of collections) {
          try {
            const docs = await this.chromaService.getDocuments(collection.name);
            totalDocuments += docs.total || 0;
            totalSessions++;
          } catch (error) {
            this.logger.warn(`Could not get stats for collection ${collection.name}: ${error.message}`);
          }
        }

        return {
          totalDocuments,
          totalSessions,
          totalMessages: totalDocuments,
          status: 'ready'
        };
      }
    } catch (error) {
      this.logger.error('Error getting memory stats:', error);
      return {
        totalDocuments: 0,
        totalSessions: 0,
        totalMessages: 0,
        collectionName,
        status: 'error'
      };
    }
  }

  /**
   * Clear all memory from collection
   */
  async clearMemory(collectionName: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`🧹 Clearing all memory from collection: ${collectionName}`);
      
      await this.chromaService.deleteCollection(collectionName);
      
      return {
        success: true,
        message: 'Memory cleared successfully'
      };
    } catch (error) {
      this.logger.error('Error clearing memory:', error);
      throw error;
    }
  }

  /**
   * Update memory document
   */
  async updateMemoryDocument(
    documentId: string,
    newContent: string,
    collectionName: string,
    metadata: Record<string, any> = {},
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean }> {
    try {
      this.logger.log(`✏️ Updating memory document ${documentId} in collection: ${collectionName}`);

      // Create new embedding for updated content
      const embedding = await this.bedrockService.createTextEmbedding(newContent);
      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to create embedding for updated content');
      }

      // Remove old document
      await this.chromaService.deleteDocuments(collectionName, [documentId]);

      // Add updated document
      const documentToAdd: ChromaDocument[] = [{
        id: documentId,
        document: newContent,
        metadata: {
          ...metadata,
          updated_at: new Date().toISOString(),
          model_id: modelId,
        },
        embedding: embedding,
      }];

      await this.chromaService.addDocuments(collectionName, documentToAdd);
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error updating memory document:', error);
      throw error;
    }
  }

  /**
   * Find related memories based on conversation context
   */
  async findRelatedMemories(
    conversationHistory: string[],
    collectionName: string,
    limit: number = 3,
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<MemoryDocument[]> {
    try {
      this.logger.log(`🔍 Finding related memories for conversation in collection: ${collectionName}`);

      if (conversationHistory.length === 0) {
        return [];
      }

      // Use the last message as query
      const query = conversationHistory[conversationHistory.length - 1];
      const results = await this.searchMemory(query, collectionName, limit, modelId);

      return results.documents;
    } catch (error) {
      this.logger.error('Error finding related memories:', error);
      return [];
    }
  }

  /**
   * Get memory summary for debugging
   */
  async getMemorySummary(collectionName: string): Promise<{
    totalDocuments: number;
    sampleDocuments: string[];
    averageContentLength: number;
    modelIds: string[];
  }> {
    try {
      this.logger.log(`📊 Getting memory summary for collection: ${collectionName}`);

      const docs = await this.chromaService.getDocuments(collectionName, 10, 0);
      
      const sampleDocuments = docs.documents?.slice(0, 3).map(doc => 
        typeof doc === 'string' ? doc : doc.document || doc.content || ''
      ) || [];

      const totalLength = docs.documents?.reduce((sum, doc) => {
        const content = typeof doc === 'string' ? doc : doc.document || doc.content || '';
        return sum + content.length;
      }, 0) || 0;

      const averageContentLength = docs.documents?.length ? totalLength / docs.documents.length : 0;

      return {
        totalDocuments: docs.total || 0,
        sampleDocuments,
        averageContentLength,
        modelIds: ['amazon.titan-embed-text-v1'] // Default model
      };
    } catch (error) {
      this.logger.error('Error getting memory summary:', error);
      return {
        totalDocuments: 0,
        sampleDocuments: [],
        averageContentLength: 0,
        modelIds: []
      };
    }
  }
} 