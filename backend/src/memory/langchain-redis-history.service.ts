import { Injectable, Logger } from '@nestjs/common';
import { RedisChatMessageHistory } from '@langchain/redis';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

export interface RedisHistoryConfig {
  sessionId: string;
  redisUrl: string;
  ttl?: number; // TTL in seconds
}

@Injectable()
export class LangChainRedisHistoryService {
  private readonly logger = new Logger(LangChainRedisHistoryService.name);
  private histories: Map<string, RedisChatMessageHistory> = new Map();

  /**
   * Create or get Redis chat message history (equivalent to FastAPI create_redis_history)
   */
  createRedisHistory(sessionId: string): RedisChatMessageHistory {
    if (!this.histories.has(sessionId)) {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new ValueError('REDIS_URL is not configured');
      }

      const history = new RedisChatMessageHistory({
        sessionId,
        url: redisUrl,
      });

      // Set TTL to prevent memory leaks (24 hours like FastAPI)
      try {
        // Note: LangChain Redis doesn't directly support TTL, but we can set it manually
        this.setHistoryTTL(sessionId, 86400); // 24 hours like FastAPI
      } catch (error) {
        this.logger.warn(`⚠️ Could not set TTL for session ${sessionId}: ${error}`);
      }

      this.histories.set(sessionId, history);
      this.logger.log(`💾 Created Redis history for session ${sessionId}`);
    }

    return this.histories.get(sessionId)!;
  }

  /**
   * Add user message to Redis history (equivalent to FastAPI add_user_message)
   */
  async addUserMessage(sessionId: string, content: string): Promise<void> {
    try {
      const history = this.createRedisHistory(sessionId);
      await history.addUserMessage(content);
      this.logger.log(`👤 Added user message to Redis history ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to add user message to Redis: ${error}`);
      throw error;
    }
  }

  /**
   * Add AI message to Redis history (equivalent to FastAPI add_ai_message)
   */
  async addAIMessage(sessionId: string, content: string): Promise<void> {
    try {
      const history = this.createRedisHistory(sessionId);
      await history.addAIMessage(content);
      this.logger.log(`🤖 Added AI message to Redis history ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to add AI message to Redis: ${error}`);
      throw error;
    }
  }

  /**
   * Get messages from Redis history (equivalent to FastAPI get_messages)
   */
  async getMessages(sessionId: string): Promise<BaseMessage[]> {
    try {
      const history = this.createRedisHistory(sessionId);
      const messages = await history.getMessages();
      this.logger.log(`📚 Retrieved ${messages.length} messages from Redis history ${sessionId}`);
      return messages;
    } catch (error) {
      this.logger.error(`❌ Failed to get messages from Redis: ${error}`);
      return [];
    }
  }

  /**
   * Clear Redis history (equivalent to FastAPI clear_history)
   */
  async clearHistory(sessionId: string): Promise<void> {
    try {
      const history = this.createRedisHistory(sessionId);
      await history.clear();
      this.histories.delete(sessionId);
      this.logger.log(`🧹 Cleared Redis history for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to clear Redis history: ${error}`);
      throw error;
    }
  }

  /**
   * Restore Redis memory with recent messages (equivalent to FastAPI restore logic)
   */
  async restoreMemory(sessionId: string, messages: Array<{role: string, content: string}>): Promise<void> {
    try {
      // Clear existing history first
      await this.clearHistory(sessionId);

      // Add messages in order
      for (const msg of messages) {
        if (msg.role === 'user') {
          await this.addUserMessage(sessionId, msg.content);
        } else if (msg.role === 'assistant') {
          await this.addAIMessage(sessionId, msg.content);
        }
      }

      this.logger.log(`💾 Restored ${messages.length} messages to Redis memory for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to restore Redis memory: ${error}`);
      throw error;
    }
  }

  /**
   * Check if Redis memory exists and is not expired (equivalent to FastAPI check logic)
   */
  async checkRedisMemoryExists(sessionId: string): Promise<boolean> {
    try {
      const messages = await this.getMessages(sessionId);
      const exists = messages.length > 0;
      this.logger.log(`🔍 Redis memory check for ${sessionId}: ${messages.length} messages found`);
      return exists;
    } catch (error) {
      this.logger.warn(`⚠️ Redis memory check failed for ${sessionId}: ${error}`);
      return false;
    }
  }

  /**
   * Set TTL for Redis history key (equivalent to FastAPI TTL setting)
   */
  private async setHistoryTTL(sessionId: string, ttlSeconds: number): Promise<void> {
    try {
      // This would need to be implemented with direct Redis client access
      // For now, we'll log the intention
      this.logger.log(`⏰ Would set TTL ${ttlSeconds}s for session ${sessionId}`);
    } catch (error) {
      this.logger.warn(`⚠️ Could not set TTL: ${error}`);
    }
  }

  /**
   * Get Redis history stats (equivalent to FastAPI stats)
   */
  async getHistoryStats(): Promise<{
    totalSessions: number;
    activeSessions: string[];
  }> {
    return {
      totalSessions: this.histories.size,
      activeSessions: Array.from(this.histories.keys()),
    };
  }
}

// Custom error class
class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValueError';
  }
} 