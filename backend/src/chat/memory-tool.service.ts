import { Injectable } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { EmbeddingService } from '../embedding/embedding.service';

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
  private readonly MAX_DOCUMENTS_PER_COLLECTION = 1000; // Prevent memory bloat
  private readonly EMBED_THRESHOLD = 10; // Embed every 10 messages like FastAPI
  
  constructor(
    private bedrockService: BedrockService,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * CRITICAL MISSING METHOD: Check if messages should be embedded
   * Called by ChatService to prevent runtime crash
   */
  shouldEmbedMessages(messageCount: number): boolean {
    return messageCount > 0 && messageCount % this.EMBED_THRESHOLD === 0;
  }

  /**
   * CRITICAL MISSING METHOD: Add chat memory 
   * Called by ChatService to prevent runtime crash
   */
  async addChatMemory(chatId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const collectionName = `chat_${chatId}`;
      
      // Check collection size to prevent memory bloat
      const stats = await this.getMemoryStats(collectionName);
      if (stats.totalDocuments >= this.MAX_DOCUMENTS_PER_COLLECTION) {
        console.warn(`Collection ${collectionName} at capacity, skipping embedding`);
        return;
      }
      
      // Combine recent messages into context
      const context = messages
        .filter(msg => msg.content && msg.content.trim())
        .slice(-5) // Only last 5 messages to prevent huge embeddings
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      if (!context.trim()) {
        return;
      }
      
      const metadata = {
        chat_id: chatId,
        message_count: messages.length,
        timestamp: new Date().toISOString(),
        type: 'chat_memory'
      };
      
      await this.addToMemory(context, collectionName, metadata);
      console.log(`Added chat memory for ${chatId}, ${messages.length} messages`);
      
    } catch (error) {
      console.error(`Failed to add chat memory for ${chatId}:`, error);
      // Don't throw error to prevent chat flow disruption
    }
  }

  /**
   * CRITICAL MISSING METHOD: Clear specific chat memory
   * Called by ChatService to prevent runtime crash
   */
  async clearChatMemory(chatId: string): Promise<void> {
    try {
      const collectionName = `chat_${chatId}`;
      await this.clearMemory(collectionName);
      console.log(`Cleared memory for chat ${chatId}`);
    } catch (error) {
      console.error(`Failed to clear chat memory for ${chatId}:`, error);
      throw error;
    }
  }

  async searchMemory(
    query: string,
    collectionName: string,
    limit: number = 5,
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<SearchResult> {
    try {
      console.log(`Searching memory for query: "${query}" in collection: ${collectionName}`);
      
      // Generate embedding for the search query
      const queryEmbedding = await this.bedrockService.generateEmbedding(query, modelId);
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn('Failed to generate query embedding, returning empty results');
        return {
          documents: [],
          query,
          totalResults: 0
        };
      }
      
      // Search for similar documents in ChromaDB
      const searchResults = await this.embeddingService.searchSimilarDocuments(
        collectionName,
        queryEmbedding,
        limit
      );
      
      if (!searchResults) {
        console.warn('ChromaDB search returned null, returning empty results');
        return {
          documents: [],
          query,
          totalResults: 0
        };
      }
      
      // Process and format results
      const documents: MemoryDocument[] = [];
      
      if (searchResults.documents && searchResults.documents[0]) {
        const docs = searchResults.documents[0];
        const metadatas = searchResults.metadatas?.[0] || [];
        const distances = searchResults.distances?.[0] || [];
        const ids = searchResults.ids?.[0] || [];
        
        for (let i = 0; i < docs.length; i++) {
          documents.push({
            id: ids[i] || `doc_${i}`,
            content: docs[i] || '',
            metadata: metadatas[i] || {},
            similarity: distances[i] ? (1 - distances[i]) : 0 // Convert distance to similarity
          });
        }
      }
      
      console.log(`Found ${documents.length} relevant documents`);
      
      return {
        documents,
        query,
        totalResults: documents.length
      };
    } catch (error) {
      console.error('Error searching memory:', error);
      return {
        documents: [],
        query,
        totalResults: 0
      };
    }
  }

  async addToMemory(
    content: string,
    collectionName: string,
    metadata: Record<string, any> = {},
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean; documentId: string }> {
    try {
      console.log(`Adding content to memory collection: ${collectionName}`);
      
      // Generate embedding for the content
      const embedding = await this.bedrockService.generateEmbedding(content, modelId);
      
      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to generate embedding for content');
      }
      
      // Create document ID
      const documentId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Add metadata about the embedding
      const enhancedMetadata = {
        ...metadata,
        model_id: modelId,
        embedding_dimension: this.bedrockService.getModelDimension(modelId),
        created_at: new Date().toISOString(),
        content_length: content.length
      };
      
      // Store in ChromaDB
      await this.embeddingService.addDocuments(collectionName, [{
        id: documentId,
        document: content,
        embedding,
        metadata: enhancedMetadata
      }]);
      
      console.log(`Successfully added document ${documentId} to memory`);
      
      return {
        success: true,
        documentId
      };
    } catch (error) {
      console.error('Error adding to memory:', error);
      throw error;
    }
  }

  async removeFromMemory(
    documentId: string,
    collectionName: string
  ): Promise<{ success: boolean }> {
    try {
      console.log(`Removing document ${documentId} from memory collection: ${collectionName}`);
      
      await this.embeddingService.deleteDocuments(collectionName, [documentId]);
      
      console.log(`Successfully removed document ${documentId} from memory`);
      
      return { success: true };
    } catch (error) {
      console.error('Error removing from memory:', error);
      throw error;
    }
  }

  async getMemoryStats(collectionName?: string): Promise<{
    totalDocuments: number;
    totalSessions: number;
    totalMessages: number;
    collectionName?: string;
    status: string;
  }> {
    try {
      if (!collectionName) {
        // Return overall stats when no specific collection requested
        console.log('Getting overall memory stats across all collections');
        return {
          totalDocuments: 0,
          totalSessions: 0,
          totalMessages: 0,
          status: 'ready'
        };
      }
      
      console.log(`Getting memory stats for collection: ${collectionName}`);
      
      const collectionInfo = await this.embeddingService.getCollectionInfo(collectionName);
      
      if (!collectionInfo) {
        return {
          totalDocuments: 0,
          totalSessions: 0,
          totalMessages: 0,
          collectionName,
          status: 'not_found'
        };
      }
      
      const documentsResult = await this.embeddingService.getDocuments(collectionName, 1, 0);
      
      return {
        totalDocuments: documentsResult.total,
        totalSessions: 1, // Each collection represents one session
        totalMessages: documentsResult.total * 5, // Estimate based on embedding chunks
        collectionName,
        status: 'active'
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        totalDocuments: 0,
        totalSessions: 0,
        totalMessages: 0,
        collectionName,
        status: 'error'
      };
    }
  }

  async clearMemory(collectionName: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`Clearing all memory from collection: ${collectionName}`);
      
      // Get all documents first
      const allDocs = await this.embeddingService.getDocuments(collectionName, 10000, 0);
      
      if (allDocs.documents.length === 0) {
        return {
          success: true,
          message: 'Collection was already empty'
        };
      }
      
      // Delete all documents
      const documentIds = allDocs.documents.map(doc => doc.id);
      await this.embeddingService.deleteDocuments(collectionName, documentIds);
      
      console.log(`Cleared ${documentIds.length} documents from memory`);
      
      return {
        success: true,
        message: `Cleared ${documentIds.length} documents from memory`
      };
    } catch (error) {
      console.error('Error clearing memory:', error);
      throw error;
    }
  }

  async updateMemoryDocument(
    documentId: string,
    newContent: string,
    collectionName: string,
    metadata: Record<string, any> = {},
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean }> {
    try {
      console.log(`Updating memory document ${documentId} in collection: ${collectionName}`);
      
      // Remove old document
      await this.removeFromMemory(documentId, collectionName);
      
      // Add updated document with same ID
      const embedding = await this.bedrockService.generateEmbedding(newContent, modelId);
      
      const enhancedMetadata = {
        ...metadata,
        model_id: modelId,
        embedding_dimension: this.bedrockService.getModelDimension(modelId),
        updated_at: new Date().toISOString(),
        content_length: newContent.length
      };
      
      await this.embeddingService.addDocuments(collectionName, [{
        id: documentId,
        document: newContent,
        embedding,
        metadata: enhancedMetadata
      }]);
      
      console.log(`Successfully updated document ${documentId}`);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating memory document:', error);
      throw error;
    }
  }

  // Utility method to find related memories based on conversation context
  async findRelatedMemories(
    conversationHistory: string[],
    collectionName: string,
    limit: number = 3,
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<MemoryDocument[]> {
    try {
      console.log(`Finding related memories for conversation in collection: ${collectionName}`);
      
      // Combine recent conversation history into a search query
      const recentContext = conversationHistory.slice(-3).join(' ');
      
      if (!recentContext.trim()) {
        return [];
      }
      
      const results = await this.searchMemory(recentContext, collectionName, limit, modelId);
      
      // Filter out documents with very low similarity
      const relevantDocs = results.documents.filter(doc => 
        doc.similarity && doc.similarity > 0.7
      );
      
      console.log(`Found ${relevantDocs.length} related memories with high similarity`);
      
      return relevantDocs;
    } catch (error) {
      console.error('Error finding related memories:', error);
      return [];
    }
  }

  // Generate summary of memory contents for debugging
  async getMemorySummary(collectionName: string): Promise<{
    totalDocuments: number;
    sampleDocuments: string[];
    averageContentLength: number;
    modelIds: string[];
  }> {
    try {
      const docs = await this.embeddingService.getDocuments(collectionName, 100, 0);
      
      const sampleDocuments = docs.documents
        .slice(0, 5)
        .map(doc => doc.document?.substring(0, 100) + '...' || 'No content');
      
      const averageLength = docs.documents.length > 0 
        ? docs.documents.reduce((sum, doc) => sum + (doc.document?.length || 0), 0) / docs.documents.length
        : 0;
      
      const modelIds = [...new Set(docs.documents
        .map(doc => doc.metadata?.model_id)
        .filter(id => id)
      )];
      
      return {
        totalDocuments: docs.total,
        sampleDocuments,
        averageContentLength: Math.round(averageLength),
        modelIds
      };
    } catch (error) {
      console.error('Error getting memory summary:', error);
      return {
        totalDocuments: 0,
        sampleDocuments: [],
        averageContentLength: 0,
        modelIds: []
      };
    }
  }
} 