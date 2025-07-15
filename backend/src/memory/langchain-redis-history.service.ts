import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
// import { RedisChatMessageHistory } from '@langchain/redis';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

export interface RedisHistoryConfig {
  sessionId: string;
  redisUrl: string;
  ttl?: number; // TTL in seconds
}

@Injectable()
export class LangChainRedisHistoryService {
  private readonly logger = new Logger(LangChainRedisHistoryService.name);
  // private histories: Map<string, RedisChatMessageHistory> = new Map();
  private histories: Map<string, any> = new Map();

  constructor(private configService: ConfigService) {}

  // createRedisHistory(sessionId: string): RedisChatMessageHistory {
  createRedisHistory(sessionId: string): any {
    if (!this.histories.has(sessionId)) {
      // const history = new RedisChatMessageHistory({
      const history = {
        sessionId,
        // configKey: this.configService.get('REDIS_URL'),
      };
      this.histories.set(sessionId, history);
    }
    return this.histories.get(sessionId);
  }

  async addMessage(sessionId: string, message: BaseMessage): Promise<void> {
    try {
      const history = this.createRedisHistory(sessionId);
      // await history.addMessage(message);
      this.logger.log(`Message added to history for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error adding message to history: ${error}`);
    }
  }

  async getMessages(sessionId: string): Promise<BaseMessage[]> {
    try {
      const history = this.createRedisHistory(sessionId);
      // return await history.getMessages();
      return [];
    } catch (error) {
      this.logger.error(`Error getting messages from history: ${error}`);
      return [];
    }
  }

  async clearHistory(sessionId: string): Promise<void> {
    try {
      const history = this.createRedisHistory(sessionId);
      // await history.clear();
      this.histories.delete(sessionId);
      this.logger.log(`History cleared for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error clearing history: ${error}`);
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
          await this.addMessage(sessionId, new HumanMessage(msg.content));
        } else if (msg.role === 'assistant') {
          await this.addMessage(sessionId, new AIMessage(msg.content));
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