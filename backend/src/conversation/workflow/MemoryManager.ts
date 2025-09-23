/**
 * ConversationMemoryManager
 *
 * จัดการ memory สำหรับ conversation ด้วย hybrid approach
 * - Redis: Short-term memory (recent messages)
 * - ChromaDB: Long-term memory (embeddings)
 * - MongoDB: Persistent storage
 */

import { redis } from '../../lib/redis';
import { chromaService } from '../../services/chromaService';
import { ConversationMessage, MemoryState, MemorySettings, EmbeddingState } from '../types';
import { ConversationMessageModel } from '../models';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

export class ConversationMemoryManager {
  private readonly REDIS_KEY_PREFIX = 'conversation_memory:';
  private readonly CHROMA_COLLECTION = 'conversation_memory';
  private readonly SHORT_TERM_TTL = 24 * 60 * 60; // 24 hours

  constructor() {
    console.log('🧠 ConversationMemoryManager initialized');
  }

  // ============= MEMORY LOADING =============

  /**
   * โหลด memory context สำหรับ conversation
   */
  public async loadMemory(
    conversationId: string,
    settings: MemorySettings
  ): Promise<MemoryState> {
    console.log(`🧠 Loading memory for conversation ${conversationId}`);

    const [shortTerm, longTerm] = await Promise.all([
      this.loadShortTermMemory(conversationId, settings),
      this.loadLongTermMemory(conversationId, settings)
    ]);

    const context = this.buildContext(shortTerm, longTerm, settings);

    return {
      shortTerm,
      longTerm: longTerm.map(embedding => ({
        pageContent: embedding.content,
        metadata: embedding.metadata
      })),
      context,
      embeddings: longTerm,
      lastUpdate: new Date()
    };
  }

  /**
   * โหลด short-term memory จาก Redis และ database
   */
  private async loadShortTermMemory(
    conversationId: string,
    settings: MemorySettings
  ): Promise<ConversationMessage[]> {
    if (!settings.shortTermEnabled) {
      return [];
    }

    try {
      // Try Redis first for performance
      const redisKey = `${this.REDIS_KEY_PREFIX}${conversationId}`;
      const cachedMessages = await redis.lrange(redisKey, 0, -1);

      if (cachedMessages.length > 0) {
        console.log(`🧠 Loaded ${cachedMessages.length} messages from Redis cache`);
        return cachedMessages.map(msg => JSON.parse(msg));
      }

      // Fallback to database
      const messages = await ConversationMessageModel.findLatestByConversation(
        conversationId,
        settings.maxShortTermMessages
      );

      // Cache in Redis for next time
      if (messages.length > 0) {
        const messagesToCache = messages
          .reverse() // Reverse to maintain chronological order
          .map(msg => JSON.stringify(msg));

        const pipeline = redis.pipeline();
        pipeline.del(redisKey);
        for (const msg of messagesToCache) {
          pipeline.rpush(redisKey, msg);
        }
        pipeline.expire(redisKey, this.SHORT_TERM_TTL);
        await pipeline.exec();

        console.log(`🧠 Cached ${messages.length} messages in Redis`);
      }

      return messages;
    } catch (error) {
      console.error('❌ Error loading short-term memory:', error);
      return [];
    }
  }

  /**
   * โหลด long-term memory จาก ChromaDB
   */
  private async loadLongTermMemory(
    conversationId: string,
    settings: MemorySettings
  ): Promise<EmbeddingState[]> {
    if (!settings.longTermEnabled || !settings.embeddingEnabled) {
      return [];
    }

    try {
      // Query recent context from ChromaDB
      const results = await chromaService.searchSimilarDocuments(
        this.CHROMA_COLLECTION,
        '', // Empty query to get recent documents
        10,
        { conversationId }
      );

      return results.map((result, index) => ({
        id: `embedding_${conversationId}_${index}`,
        content: result.pageContent,
        embedding: [], // ChromaDB handles embeddings internally
        metadata: result.metadata,
        createdAt: new Date(result.metadata.timestamp || Date.now())
      }));
    } catch (error) {
      console.error('❌ Error loading long-term memory:', error);
      return [];
    }
  }

  // ============= CONTEXT BUILDING =============

  /**
   * สร้าง context string จาก memory
   */
  private buildContext(
    shortTerm: ConversationMessage[],
    longTerm: EmbeddingState[],
    settings: MemorySettings
  ): string {
    const contextParts: string[] = [];

    // Add long-term context if available
    if (longTerm.length > 0) {
      contextParts.push('Previous conversation context:');
      longTerm.slice(0, 3).forEach(memory => {
        contextParts.push(`- ${memory.content.substring(0, 200)}...`);
      });
      contextParts.push('');
    }

    // Add recent messages
    if (shortTerm.length > 0) {
      contextParts.push('Recent conversation:');
      shortTerm.slice(-settings.contextWindow || -5).forEach(message => {
        const role = message.role === 'user' ? 'Human' : 'Assistant';
        contextParts.push(`${role}: ${message.content}`);
      });
    }

    return contextParts.join('\\n');
  }

  // ============= MEMORY UPDATING =============

  /**
   * อัพเดท memory หลังจาก conversation
   */
  public async updateMemory(
    conversationId: string,
    messages: ConversationMessage[],
    settings: MemorySettings
  ): Promise<void> {
    console.log(`🧠 Updating memory for conversation ${conversationId}`);

    const updatePromises: Promise<void>[] = [];

    // Update short-term memory
    if (settings.shortTermEnabled) {
      updatePromises.push(this.updateShortTermMemory(conversationId, messages, settings));
    }

    // Update long-term memory if threshold is met
    if (settings.embeddingEnabled && this.shouldCreateEmbedding(messages.length, settings)) {
      updatePromises.push(this.updateLongTermMemory(conversationId, messages, settings));
    }

    await Promise.allSettled(updatePromises);
  }

  /**
   * อัพเดท short-term memory ใน Redis
   */
  private async updateShortTermMemory(
    conversationId: string,
    messages: ConversationMessage[],
    settings: MemorySettings
  ): Promise<void> {
    try {
      const redisKey = `${this.REDIS_KEY_PREFIX}${conversationId}`;
      const pipeline = redis.pipeline();

      // Get current messages
      const currentMessages = await redis.lrange(redisKey, 0, -1);
      const currentCount = currentMessages.length;

      // Add new messages
      const newMessages = messages.slice(currentCount);
      for (const message of newMessages) {
        pipeline.rpush(redisKey, JSON.stringify(message));
      }

      // Trim to max size
      const maxSize = settings.maxShortTermMessages || 10;
      pipeline.ltrim(redisKey, -maxSize, -1);
      pipeline.expire(redisKey, this.SHORT_TERM_TTL);

      await pipeline.exec();
      console.log(`🧠 Updated short-term memory: ${newMessages.length} new messages`);
    } catch (error) {
      console.error('❌ Error updating short-term memory:', error);
    }
  }

  /**
   * อัพเดท long-term memory ใน ChromaDB
   */
  private async updateLongTermMemory(
    conversationId: string,
    messages: ConversationMessage[],
    settings: MemorySettings
  ): Promise<void> {
    try {
      // Create conversation summary for embedding
      const summary = this.createConversationSummary(messages);

      if (summary.length < 50) {
        return; // Skip very short summaries
      }

      // Store in ChromaDB
      await chromaService.addDocuments(this.CHROMA_COLLECTION, [
        {
          pageContent: summary,
          metadata: {
            conversationId,
            messageCount: messages.length,
            timestamp: new Date().toISOString(),
            type: 'conversation_summary'
          }
        }
      ]);

      console.log(`🧠 Created long-term memory embedding for ${messages.length} messages`);
    } catch (error) {
      console.error('❌ Error updating long-term memory:', error);
    }
  }

  // ============= UTILITY METHODS =============

  /**
   * สร้าง summary ของ conversation สำหรับ embedding
   */
  private createConversationSummary(messages: ConversationMessage[]): string {
    const recentMessages = messages.slice(-10); // Last 10 messages
    const conversationText = recentMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\\n');

    // Create a summary (in real implementation, you might want to use an LLM for this)
    return `Conversation summary:\\n${conversationText}`;
  }

  /**
   * ตรวจสอบว่าควรสร้าง embedding หรือไม่
   */
  private shouldCreateEmbedding(messageCount: number, settings: MemorySettings): boolean {
    const threshold = settings.embeddingThreshold || 10;
    return messageCount > 0 && messageCount % threshold === 0;
  }

  // ============= MEMORY SEARCH =============

  /**
   * ค้นหา memory ที่เกี่ยวข้อง
   */
  public async searchMemory(
    conversationId: string,
    query: string,
    limit: number = 5
  ): Promise<EmbeddingState[]> {
    try {
      const results = await chromaService.searchSimilarDocuments(
        this.CHROMA_COLLECTION,
        query,
        limit,
        { conversationId }
      );

      return results.map((result, index) => ({
        id: `search_${conversationId}_${index}`,
        content: result.pageContent,
        embedding: [],
        metadata: result.metadata,
        createdAt: new Date(result.metadata.timestamp || Date.now())
      }));
    } catch (error) {
      console.error('❌ Error searching memory:', error);
      return [];
    }
  }

  // ============= MEMORY MANAGEMENT =============

  /**
   * ล้าง memory สำหรับ conversation
   */
  public async clearMemory(conversationId: string): Promise<void> {
    console.log(`🧹 Clearing memory for conversation ${conversationId}`);

    const clearPromises = [
      // Clear Redis cache
      redis.del(`${this.REDIS_KEY_PREFIX}${conversationId}`),

      // Clear ChromaDB (if supported)
      this.clearLongTermMemory(conversationId)
    ];

    await Promise.allSettled(clearPromises);
  }

  /**
   * ล้าง long-term memory จาก ChromaDB
   */
  private async clearLongTermMemory(conversationId: string): Promise<void> {
    try {
      // ChromaDB doesn't have direct delete by metadata, so we need to find and delete
      const results = await chromaService.searchSimilarDocuments(
        this.CHROMA_COLLECTION,
        '',
        1000, // Large number to get all
        { conversationId }
      );

      if (results.length > 0) {
        // In a real implementation, you would delete these documents
        console.log(`🧹 Found ${results.length} long-term memories to clear`);
      }
    } catch (error) {
      console.error('❌ Error clearing long-term memory:', error);
    }
  }

  // ============= STATISTICS =============

  /**
   * ดู memory statistics
   */
  public async getMemoryStats(conversationId: string): Promise<{
    shortTermCount: number;
    longTermCount: number;
    totalSize: number;
  }> {
    try {
      const [shortTermCount, longTermResults] = await Promise.all([
        redis.llen(`${this.REDIS_KEY_PREFIX}${conversationId}`),
        chromaService.searchSimilarDocuments(
          this.CHROMA_COLLECTION,
          '',
          1000,
          { conversationId }
        )
      ]);

      return {
        shortTermCount,
        longTermCount: longTermResults.length,
        totalSize: shortTermCount + longTermResults.length
      };
    } catch (error) {
      console.error('❌ Error getting memory stats:', error);
      return { shortTermCount: 0, longTermCount: 0, totalSize: 0 };
    }
  }

  // ============= CLEANUP =============

  public cleanup(): void {
    // Cleanup resources if needed
    console.log('🧹 ConversationMemoryManager cleaned up');
  }
}