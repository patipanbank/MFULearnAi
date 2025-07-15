import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  id?: string;
}

@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);
  private readonly MESSAGE_STORE_PREFIX = 'message_store';
  private readonly TTL_SECONDS = 86400; // 24 hours like FastAPI

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get the Redis key for a session
   */
  private getMessageKey(sessionId: string): string {
    return `${this.MESSAGE_STORE_PREFIX}:${sessionId}`;
  }

  /**
   * Add a user message to Redis memory (เหมือน history.add_user_message)
   */
  async addUserMessage(sessionId: string, content: string): Promise<void> {
    const message: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date(),
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    await this.addMessage(sessionId, message);
    this.logger.debug(`Added user message to session ${sessionId}`);
  }

  /**
   * Add an AI message to Redis memory (เหมือน history.add_ai_message)
   */
  async addAiMessage(sessionId: string, content: string): Promise<void> {
    const message: ChatMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    await this.addMessage(sessionId, message);
    this.logger.debug(`Added AI message to session ${sessionId}`);
  }

  /**
   * Add a system message to Redis memory
   */
  async addSystemMessage(sessionId: string, content: string): Promise<void> {
    const message: ChatMessage = {
      role: 'system',
      content,
      timestamp: new Date(),
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    await this.addMessage(sessionId, message);
    this.logger.debug(`Added system message to session ${sessionId}`);
  }

  /**
   * Add a message to Redis memory with automatic trimming (keep last 10 messages)
   */
  private async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const key = this.getMessageKey(sessionId);
    const redis = this.redisService.getRedisInstance();

    try {
      // Add message to the list
      await redis.lpush(key, JSON.stringify(message));

      // Keep only the last 10 messages (เหมือน FastAPI)
      await redis.ltrim(key, 0, 9);

      // Set TTL to prevent memory leaks (24 hours)
      await redis.expire(key, this.TTL_SECONDS);

      this.logger.debug(`Message added and trimmed for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to add message to session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get all messages from Redis memory (เหมือน history.messages)
   */
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const key = this.getMessageKey(sessionId);
    const redis = this.redisService.getRedisInstance();

    try {
      const messages = await redis.lrange(key, 0, -1);
      
      // Parse and reverse to get chronological order (oldest first)
      const parsedMessages = messages
        .map(msg => JSON.parse(msg))
        .reverse(); // Redis lpush stores newest first, we want oldest first

      this.logger.debug(`Retrieved ${parsedMessages.length} messages for session ${sessionId}`);
      return parsedMessages;
    } catch (error) {
      this.logger.error(`Failed to get messages for session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Clear all messages from Redis memory (เหมือน history.clear())
   */
  async clear(sessionId: string): Promise<void> {
    const key = this.getMessageKey(sessionId);
    const redis = this.redisService.getRedisInstance();

    try {
      await redis.del(key);
      this.logger.log(`🧹 Cleared Redis memory for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to clear memory for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Check if Redis memory exists for a session
   */
  async hasMemory(sessionId: string): Promise<boolean> {
    const key = this.getMessageKey(sessionId);
    const redis = this.redisService.getRedisInstance();

    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check memory existence for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{ totalSessions: number; totalMessages: number }> {
    const redis = this.redisService.getRedisInstance();

    try {
      const keys = await redis.keys(`${this.MESSAGE_STORE_PREFIX}:*`);
      let totalMessages = 0;

      for (const key of keys) {
        const messageCount = await redis.llen(key);
        totalMessages += messageCount;
      }

      return {
        totalSessions: keys.length,
        totalMessages,
      };
    } catch (error) {
      this.logger.error('Failed to get memory stats:', error);
      return { totalSessions: 0, totalMessages: 0 };
    }
  }

  /**
   * Restore messages from database to Redis memory (เหมือน FastAPI restore logic)
   */
  async restoreFromHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    // Take only the last 10 messages
    const recentMessages = messages.slice(-10);

    if (recentMessages.length === 0) {
      return;
    }

    const key = this.getMessageKey(sessionId);
    const redis = this.redisService.getRedisInstance();

    try {
      // Clear existing memory first
      await redis.del(key);

      // Add messages in reverse order (newest first for lpush)
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        await redis.lpush(key, JSON.stringify(recentMessages[i]));
      }

      // Set TTL
      await redis.expire(key, this.TTL_SECONDS);

      this.logger.log(`💾 Restored ${recentMessages.length} messages to Redis memory for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to restore memory for session ${sessionId}:`, error);
      throw error;
    }
  }
} 