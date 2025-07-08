
import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../infrastructure/bedrock/bedrock.service';
import { ChromaService } from './chroma.service';
import { v4 as uuidv4 } from 'uuid';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

interface ChatMemoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date | string;
  metadata?: Record<string, any>;
}

interface MemorySearchResult {
  documents: string[][];
  metadatas: Record<string, any>[][];
  distances: number[][];
}

export interface MemoryStats {
  sessionId: string;
  totalMessages: number;
  embeddedMessages: number;
  lastEmbeddingTime?: Date;
  memorySize: number;
  averageMessageLength: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly maxMessagesInMemory = 100; // Maximum messages to keep in vector memory
  private readonly embeddingThreshold = 10; // Embed every N messages
  private readonly maxSearchResults = 10;

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly chromaService: ChromaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private collectionName(sessionId: string): string {
    return `chat_memory_${sessionId}`;
  }

  private cacheKey(sessionId: string, key: string): string {
    return `memory:${sessionId}:${key}`;
  }

  /**
   * Add chat messages to memory with smart batching and deduplication
   */
  async addChatMemory(sessionId: string, messages: ChatMemoryMessage[]): Promise<void> {
    if (!messages.length) {
      this.logger.debug(`No messages to add for session: ${sessionId}`);
      return;
    }

    const colName = this.collectionName(sessionId);
    
    try {
      // Check if messages already exist in memory
      const existingIds = await this.getExistingMessageIds(colName);
      const newMessages = messages.filter(msg => !existingIds.has(msg.id));
      
      if (newMessages.length === 0) {
        this.logger.debug(`All messages already exist in memory for session: ${sessionId}`);
        return;
      }

      this.logger.log(`📚 Adding ${newMessages.length} new messages to memory for session: ${sessionId}`);

      // Process messages in batches to avoid overwhelming the embedding service
      const batchSize = 5;
      for (let i = 0; i < newMessages.length; i += batchSize) {
        const batch = newMessages.slice(i, i + batchSize);
        await this.processBatch(colName, batch);
      }

      // Update cache with new stats
      await this.updateMemoryStats(sessionId, newMessages.length);
      
      // Cleanup old messages if we exceed the limit
      await this.cleanupOldMemories(colName);

      this.logger.log(`✅ Successfully added ${newMessages.length} messages to memory`);

    } catch (error) {
      this.logger.error(`Failed to add chat memory for session ${sessionId}:`, error);
      throw error;
    }
  }

  private async getExistingMessageIds(collectionName: string): Promise<Set<string>> {
    try {
      const existing = await this.chromaService.getDocuments(collectionName, 1000);
      return new Set(existing?.ids || []);
    } catch (error) {
      this.logger.warn(`Could not get existing message IDs: ${error}`);
      return new Set();
    }
  }

  private async processBatch(collectionName: string, messages: ChatMemoryMessage[]): Promise<void> {
    // Prepare texts for embedding (combine role and content for better context)
    const texts = messages.map(msg => {
      const content = msg.content.slice(0, 2000); // Truncate long messages
      return `[${msg.role.toUpperCase()}] ${content}`;
    });

    // Create embeddings
    const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);

    // Prepare documents for ChromaDB
    const docs = messages.map((msg, idx) => ({
      id: msg.id,
      text: texts[idx],
      embedding: embeddings[idx],
      metadata: {
        role: msg.role,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
        originalLength: msg.content.length,
        ...msg.metadata
      },
    }));

    // Filter out failed embeddings
    const validDocs = docs.filter(doc => doc.embedding && doc.embedding.length > 0);
    
    if (validDocs.length !== docs.length) {
      this.logger.warn(`${docs.length - validDocs.length} messages failed to embed`);
    }

    if (validDocs.length > 0) {
      await this.chromaService.addDocuments(collectionName, validDocs);
    }
  }

  /**
   * Smart semantic search with relevance scoring and context optimization
   */
  async searchChatMemory(
    sessionId: string, 
    query: string, 
    topK: number = 5,
    minSimilarity: number = 0.7
  ): Promise<MemorySearchResult | null> {
    const colName = this.collectionName(sessionId);
    
    try {
      // Check cache first
      const cacheKey = this.cacheKey(sessionId, `search:${query}:${topK}`);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`🎯 Cache hit for memory search: ${sessionId}`);
        return JSON.parse(cached);
      }

      // Create query embedding
      const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        this.logger.warn(`Failed to create embedding for query: ${query}`);
        return null;
      }

      // Search in ChromaDB
      const searchResult = await this.chromaService.queryCollection(
        colName, 
        queryEmbedding, 
        Math.min(topK, this.maxSearchResults)
      );

      if (!searchResult) {
        return null;
      }

      // Filter results by similarity threshold
      const filteredResult = this.filterBySimilarity(searchResult, minSimilarity);
      
      // Cache the result for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(filteredResult));

      this.logger.debug(`🔍 Found ${filteredResult.documents[0]?.length || 0} relevant memories for query`);
      return filteredResult;

    } catch (error) {
      this.logger.error(`Memory search failed for session ${sessionId}:`, error);
      return null;
    }
  }

  private filterBySimilarity(
    result: any, 
    minSimilarity: number
  ): MemorySearchResult {
    if (!result.distances || !result.distances[0]) {
      return result;
    }

    const distances = result.distances[0];
    const documents = result.documents[0] || [];
    const metadatas = result.metadatas[0] || [];

    const filtered: MemorySearchResult = {
      documents: [[] as string[]],
      metadatas: [[] as Record<string, any>[]],
      distances: [[] as number[]]
    };

    for (let i = 0; i < distances.length; i++) {
      // Convert distance to similarity (lower distance = higher similarity)
      const similarity = 1 - distances[i];
      
      if (similarity >= minSimilarity) {
        filtered.documents[0].push(documents[i]);
        filtered.metadatas[0].push(metadatas[i]);
        filtered.distances[0].push(distances[i]);
      }
    }

    return filtered as MemorySearchResult;
  }

  /**
   * Get comprehensive memory statistics
   */
  async getMemoryStats(sessionId: string): Promise<MemoryStats> {
    const colName = this.collectionName(sessionId);
    
    try {
      const count = await this.chromaService.countDocuments(colName);
      const docs = await this.chromaService.getDocuments(colName, 10); // Sample for stats
      
      let averageLength = 0;
      let lastEmbeddingTime: Date | undefined;
      
      if (docs?.metadatas && docs.metadatas.length > 0) {
        const lengths = docs.metadatas
          .filter(meta => meta && typeof meta.originalLength === 'number')
          .map(meta => meta!.originalLength as number)
          .filter(length => length > 0);
        
        averageLength = lengths.length > 0 
          ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
          : 0;

        // Find most recent embedding
        const timestamps = docs.metadatas
          .filter(meta => meta && meta.timestamp && typeof meta.timestamp === 'string')
          .map(meta => meta!.timestamp as string)
          .sort()
          .reverse();
        
        if (timestamps.length > 0) {
          lastEmbeddingTime = new Date(timestamps[0]);
        }
      }

      return {
        sessionId,
        totalMessages: count,
        embeddedMessages: count,
        lastEmbeddingTime,
        memorySize: count * averageLength, // Approximate memory size
        averageMessageLength: averageLength
      };

    } catch (error) {
      this.logger.error(`Failed to get memory stats for session ${sessionId}:`, error);
      return {
        sessionId,
        totalMessages: 0,
        embeddedMessages: 0,
        memorySize: 0,
        averageMessageLength: 0
      };
    }
  }

  /**
   * Clear all memory for a session
   */
  async clearChatMemory(sessionId: string): Promise<void> {
    const colName = this.collectionName(sessionId);
    
    try {
      await this.chromaService.deleteCollection(colName);
      
      // Clear related cache entries
      const pattern = this.cacheKey(sessionId, '*');
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.logger.log(`🧹 Cleared memory for session: ${sessionId}`);
      
    } catch (error) {
      this.logger.error(`Failed to clear memory for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Optimize memory by removing old or irrelevant messages
   */
  async optimizeMemory(sessionId: string): Promise<void> {
    const colName = this.collectionName(sessionId);
    
    try {
      const count = await this.chromaService.countDocuments(colName);
      
      if (count <= this.maxMessagesInMemory) {
        this.logger.debug(`Memory already optimized for session: ${sessionId}`);
        return;
      }

      // Get all documents with metadata
      const docs = await this.chromaService.getDocuments(colName, count);
      
      if (!docs?.ids || !docs?.metadatas) {
        return;
      }

      // Sort by timestamp and keep only recent messages
      const indexed = docs.ids.map((id, i) => {
        const metadata = docs.metadatas![i];
        const timestamp = metadata?.timestamp;
        return {
          id,
          timestamp: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
          metadata
        };
      });

      indexed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Keep only the most recent messages
      const toKeep = indexed.slice(0, this.maxMessagesInMemory);
      const toDelete = indexed.slice(this.maxMessagesInMemory).map(item => item.id);
      
      if (toDelete.length > 0) {
        await this.chromaService.deleteDocuments(colName, toDelete);
        this.logger.log(`🗑️ Deleted ${toDelete.length} old messages from memory for session: ${sessionId}`);
      }

    } catch (error) {
      this.logger.error(`Failed to optimize memory for session ${sessionId}:`, error);
    }
  }

  private async cleanupOldMemories(collectionName: string): Promise<void> {
    try {
      const count = await this.chromaService.countDocuments(collectionName);
      
      if (count > this.maxMessagesInMemory) {
        const sessionId = collectionName.replace('chat_memory_', '');
        await this.optimizeMemory(sessionId);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup old memories: ${error}`);
    }
  }

  private async updateMemoryStats(sessionId: string, newMessageCount: number): Promise<void> {
    try {
      const statsKey = this.cacheKey(sessionId, 'stats');
      const stats = {
        lastUpdate: new Date().toISOString(),
        messagesAdded: newMessageCount,
        totalSessions: await this.getTotalSessions()
      };
      
      await this.redis.setex(statsKey, 3600, JSON.stringify(stats));
    } catch (error) {
      this.logger.warn(`Failed to update memory stats: ${error}`);
    }
  }

  private async getTotalSessions(): Promise<number> {
    try {
      const keys = await this.redis.keys('memory:*:stats');
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get memory usage across all sessions
   */
  async getGlobalMemoryStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    averageMessagesPerSession: number;
  }> {
    try {
      const sessions = await this.redis.keys('memory:*:stats');
      let totalMessages = 0;
      
      for (const sessionKey of sessions) {
        try {
          const sessionId = sessionKey.split(':')[1];
          const stats = await this.getMemoryStats(sessionId);
          totalMessages += stats.totalMessages;
        } catch (error) {
          // Skip failed sessions
        }
      }
      
      return {
        totalSessions: sessions.length,
        totalMessages,
        averageMessagesPerSession: sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0
      };
      
    } catch (error) {
      this.logger.error(`Failed to get global memory stats:`, error);
      return {
        totalSessions: 0,
        totalMessages: 0,
        averageMessagesPerSession: 0
      };
    }
  }

  /**
   * Check if a session should be embedded based on message count
   */
  shouldEmbedSession(messageCount: number): boolean {
    return messageCount > 0 && messageCount % this.embeddingThreshold === 0;
  }

  /**
   * Preload memory for better performance
   */
  async preloadMemory(sessionId: string): Promise<void> {
    try {
      // Warm up the memory by doing a simple search
      await this.searchChatMemory(sessionId, 'context', 1);
      this.logger.debug(`🔥 Preloaded memory for session: ${sessionId}`);
    } catch (error) {
      this.logger.warn(`Failed to preload memory: ${error}`);
    }
  }
} 