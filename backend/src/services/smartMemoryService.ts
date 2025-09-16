import { chromaService } from './chromaService';
import { embeddingService } from './embeddingService';
import { redis } from '../lib/redis';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface MemorySearchResult {
  content: string;
  role: string;
  timestamp: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

/**
 * SmartMemoryService - Simplified memory management
 * Uses on-demand embedding and intelligent caching
 */
export class SmartMemoryService {
  private readonly RECENT_MESSAGE_LIMIT = 15; // Keep recent messages in Redis
  private readonly MIN_RELEVANCE_SCORE = 0.75; // Higher threshold for relevance
  private readonly CONTEXT_TOKEN_LIMIT = 3000; // Reduced token limit

  /**
   * Add message with smart caching - only embed if necessary
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    try {
      // 1. Always add to recent cache
      await this.addToRecentCache(sessionId, message);

      // 2. Only embed if it's likely to be searched later
      if (this.shouldEmbed(message)) {
        await this.embedMessage(sessionId, message);
      }

    } catch (error) {
      console.error(`❌ Error adding message to smart memory: ${error}`);
      throw error;
    }
  }

  /**
   * Get conversation context with intelligent retrieval
   */
  async getConversationContext(sessionId: string, query?: string): Promise<ConversationMessage[]> {
    try {
      // 1. Always get recent messages first (fast Redis lookup)
      const recentMessages = await this.getRecentMessages(sessionId);

      // 2. If query provided, search for relevant historical messages
      if (query && query.trim().length > 10) { // Only search for substantial queries
        const relevantMessages = await this.searchRelevantMessages(sessionId, query);
        return this.mergeMessages(recentMessages, relevantMessages);
      }

      return recentMessages;

    } catch (error) {
      console.error(`❌ Error getting conversation context: ${error}`);
      return [];
    }
  }

  /**
   * Search memory with semantic understanding
   */
  async searchMemory(sessionId: string, query: string, limit: number = 5): Promise<MemorySearchResult[]> {
    try {
      if (!query?.trim() || query.length < 5) {
        return [];
      }

      const queryEmbedding = await embeddingService.embed(query);
      if (!queryEmbedding || queryEmbedding.length === 0) return [];

      const results = await chromaService.queryCollection(
        `smart_memory_${sessionId}`,
        [queryEmbedding],
        limit * 2 // Get more results to filter
      );

      if (!results?.documents || !results?.distances || !results?.metadatas) {
        return [];
      }

      const processedResults: MemorySearchResult[] = [];
      const documents = results.documents.flat();
      const distances = results.distances.flat();
      const metadatas = results.metadatas.flat();

      for (let i = 0; i < documents.length && processedResults.length < limit; i++) {
        const relevanceScore = Math.max(0, 1 - (distances[i] || 1));

        if (relevanceScore >= this.MIN_RELEVANCE_SCORE) {
          const metadata = metadatas[i];
          processedResults.push({
            content: String(documents[i] || ''),
            role: String(metadata?.role || 'user'),
            timestamp: String(metadata?.timestamp || ''),
            relevanceScore,
            metadata: metadata || undefined
          });
        }
      }

      return processedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    } catch (error) {
      console.error(`❌ Error searching smart memory: ${error}`);
      return [];
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async addToRecentCache(sessionId: string, message: ConversationMessage): Promise<void> {
    const key = `smart_memory:recent:${sessionId}`;
    const messageStr = JSON.stringify(message);

    await redis.lpush(key, messageStr);
    await redis.ltrim(key, 0, this.RECENT_MESSAGE_LIMIT - 1);
    await redis.expire(key, 86400); // 24 hours
  }

  private async getRecentMessages(sessionId: string): Promise<ConversationMessage[]> {
    const key = `smart_memory:recent:${sessionId}`;
    const items = await redis.lrange(key, 0, -1);

    return items
      .map(item => {
        try {
          return JSON.parse(item) as ConversationMessage;
        } catch {
          return null;
        }
      })
      .filter((item): item is ConversationMessage => item !== null)
      .reverse(); // Chronological order
  }

  private shouldEmbed(message: ConversationMessage): boolean {
    // Smart decision: only embed substantial messages
    if (message.role === 'system') return false;
    if (message.content.length < 20) return false;

    // Embed user questions and substantial assistant responses
    if (message.role === 'user') {
      return message.content.includes('?') || message.content.length > 50;
    }

    if (message.role === 'assistant') {
      return message.content.length > 100;
    }

    return false;
  }

  private async embedMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    try {
      const embedding = await embeddingService.embed(message.content);
      if (!embedding || embedding.length === 0) return;

      const contentHash = Buffer.from(message.content + message.timestamp).toString('base64');
      const collectionName = `smart_memory_${sessionId}`;

      // Check if already exists
      const exists = await chromaService.documentExists(collectionName, contentHash);
      if (exists) return;

      // Add to ChromaDB
      await chromaService.addToCollection(
        collectionName,
        [message.content],
        [embedding],
        [{
          role: message.role,
          timestamp: message.timestamp,
          sessionId,
          ...message.metadata
        }],
        [contentHash]
      );

    } catch (error) {
      console.error(`❌ Error embedding message: ${error}`);
      // Don't throw - embedding failure shouldn't break the flow
    }
  }

  private async searchRelevantMessages(sessionId: string, query: string): Promise<ConversationMessage[]> {
    const searchResults = await this.searchMemory(sessionId, query, 3);

    return searchResults.map(result => ({
      role: result.role as 'user' | 'assistant' | 'system',
      content: result.content,
      timestamp: result.timestamp,
      metadata: {
        ...result.metadata,
        relevanceScore: result.relevanceScore,
        source: 'vector_search'
      }
    }));
  }

  private mergeMessages(
    recentMessages: ConversationMessage[],
    relevantMessages: ConversationMessage[]
  ): ConversationMessage[] {
    // Deduplicate based on content + timestamp
    const seen = new Set<string>();
    const merged: ConversationMessage[] = [];

    // Add relevant messages first (sorted by relevance)
    for (const msg of relevantMessages) {
      const key = `${msg.content.substring(0, 50)}_${msg.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(msg);
      }
    }

    // Add recent messages (keep chronological order)
    for (const msg of recentMessages) {
      const key = `${msg.content.substring(0, 50)}_${msg.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(msg);
      }
    }

    // Sort by timestamp and apply token limit
    const sorted = merged.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return this.trimToTokenLimit(sorted);
  }

  private trimToTokenLimit(messages: ConversationMessage[]): ConversationMessage[] {
    let totalTokens = 0;
    const result: ConversationMessage[] = [];

    // Process from most recent backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const estimatedTokens = Math.ceil(msg.content.length / 4);

      if (totalTokens + estimatedTokens <= this.CONTEXT_TOKEN_LIMIT) {
        result.unshift(msg);
        totalTokens += estimatedTokens;
      } else {
        break;
      }
    }

    return result;
  }

  // ===== MAINTENANCE METHODS =====

  async clearSession(sessionId: string): Promise<void> {
    try {
      // Clear recent cache
      await redis.del(`smart_memory:recent:${sessionId}`);

      // Clear vector store
      await chromaService.deleteCollection(`smart_memory_${sessionId}`);

      console.log(`🧹 Cleared smart memory for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error clearing session memory: ${error}`);
    }
  }

  async getMemoryStats(sessionId: string): Promise<{
    recentCount: number;
    embeddedCount: number;
    memoryType: string;
  }> {
    try {
      const recentCount = await redis.llen(`smart_memory:recent:${sessionId}`);

      let embeddedCount = 0;
      try {
        const allMessages = await chromaService.getAllFromCollection(`smart_memory_${sessionId}`);
        embeddedCount = Array.isArray(allMessages) ? allMessages.length : 0;
      } catch {
        embeddedCount = 0;
      }

      return {
        recentCount,
        embeddedCount,
        memoryType: 'smart_on_demand'
      };
    } catch (error) {
      console.error(`❌ Error getting memory stats: ${error}`);
      return { recentCount: 0, embeddedCount: 0, memoryType: 'error' };
    }
  }
}

export const smartMemoryService = new SmartMemoryService();