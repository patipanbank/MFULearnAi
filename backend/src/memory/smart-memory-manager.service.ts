import { Injectable, Logger } from '@nestjs/common';
import { VectorMemoryService } from './vector-memory.service';
import { LangChainRedisHistoryService } from './langchain-redis-history.service';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class SmartMemoryManagerService {
  private readonly logger = new Logger(SmartMemoryManagerService.name);

  constructor(
    private vectorMemoryService: VectorMemoryService,
    private redisHistoryService: LangChainRedisHistoryService,
  ) {}

  /**
   * Setup smart memory management (equivalent to FastAPI smart memory setup)
   * เหมือน FastAPI ทุกอย่าง
   */
  async setupSmartMemoryManagement(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const messageCount = messages.length;
      this.logger.log(`🧠 Setting up smart memory management for ${sessionId} (${messageCount} messages)`);

      // Check if Redis memory exists and is not expired (เหมือน FastAPI)
      const redisMemoryExists = await this.redisHistoryService.checkRedisMemoryExists(sessionId);
      this.logger.log(`🔍 Redis memory check: ${redisMemoryExists ? 'exists' : 'empty'}`);

      // If Redis memory is empty but we have messages, restore recent context (เหมือน FastAPI)
      if (!redisMemoryExists && messages.length > 0) {
        this.logger.log(`🔄 Redis memory empty, restoring recent context for session ${sessionId}`);
        
        // Get last 10 messages to restore Redis memory (เหมือน FastAPI)
        const recentMessages = messages.length >= 10 ? messages.slice(-10) : messages;
        
        // Restore Redis memory with recent messages (เหมือน FastAPI)
        try {
          const redisMessages = recentMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }));
          
          await this.redisHistoryService.restoreMemory(sessionId, redisMessages);
          this.logger.log(`💾 Restored ${recentMessages.length} messages to Redis memory`);
        } catch (error) {
          this.logger.error(`❌ Failed to restore Redis memory: ${error}`);
        }
      }

      // Check if we should embed messages (every 10 messages like FastAPI)
      if (this.shouldEmbedMessages(messageCount)) {
        this.logger.log(`🔄 Embedding messages for session ${sessionId} (message count: ${messageCount})`);
        
        // Add to vector memory (เหมือน FastAPI)
        await this.vectorMemoryService.addChatMemory(sessionId, messages);
        this.logger.log(`📚 Embedded ${messages.length} messages to vector memory for session ${sessionId}`);
      }

      // Use memory tool if available (for long conversations like FastAPI)
      if (this.shouldUseMemoryTool(messageCount)) {
        this.logger.log(`🔍 Vector memory available for session ${sessionId} (${messageCount} messages)`);
      } else {
        this.logger.log(`💾 Using Redis memory only for session ${sessionId} (${messageCount} messages)`);
      }

    } catch (error) {
      this.logger.warn(`⚠️ Failed to setup smart memory management: ${error}`);
    }
  }

  /**
   * Get memory strategy based on message count (equivalent to FastAPI logic)
   */
  getMemoryStrategy(messageCount: number): 'basic' | 'redis' | 'vector' {
    if (messageCount > 50) {
      return 'vector'; // Long conversations use vector memory
    } else if (messageCount > 10) {
      return 'redis'; // Medium conversations use Redis
    } else {
      return 'basic'; // Short conversations use basic memory
    }
  }

  /**
   * Should use memory tool (equivalent to FastAPI _should_use_memory_tool)
   */
  shouldUseMemoryTool(messageCount: number): boolean {
    return messageCount > 50; // เหมือน FastAPI
  }

  /**
   * Should use Redis memory (equivalent to FastAPI _should_use_redis_memory)
   */
  shouldUseRedisMemory(messageCount: number): boolean {
    return messageCount > 10; // เหมือน FastAPI
  }

  /**
   * Should embed messages (equivalent to FastAPI _should_embed_messages)
   */
  shouldEmbedMessages(messageCount: number): boolean {
    return messageCount % 10 === 0 && messageCount > 0; // ทุก 10 messages เหมือน FastAPI
  }

  /**
   * Get relevant context for current conversation (equivalent to FastAPI context retrieval)
   */
  async getRelevantContext(sessionId: string, query: string, messageCount: number): Promise<ChatMessage[]> {
    const strategy = this.getMemoryStrategy(messageCount);
    
    switch (strategy) {
      case 'vector':
        // Use vector memory for semantic search (เหมือน FastAPI)
        this.logger.log(`🔍 Using vector memory for context retrieval: ${sessionId}`);
        return await this.vectorMemoryService.searchChatMemory(sessionId, query, 5);
        
      case 'redis':
        // Use Redis memory for recent context (เหมือน FastAPI)
        this.logger.log(`💾 Using Redis memory for context retrieval: ${sessionId}`);
        const redisMessages = await this.redisHistoryService.getMessages(sessionId);
        return this.convertRedisMessages(redisMessages);
        
      case 'basic':
      default:
        // No additional context needed for short conversations
        this.logger.log(`📝 Using basic memory for context retrieval: ${sessionId}`);
        return [];
    }
  }

  /**
   * Convert Redis LangChain messages to our ChatMessage format
   */
  private convertRedisMessages(redisMessages: any[]): ChatMessage[] {
    return redisMessages.map((msg, index) => ({
      id: `redis_${index}`,
      role: msg._getType() === 'human' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Clear all memory for session (equivalent to FastAPI clear_chat_memory)
   */
  async clearAllMemory(sessionId: string): Promise<void> {
    try {
      // Clear Redis memory
      await this.redisHistoryService.clearHistory(sessionId);
      
      // Clear vector memory
      await this.vectorMemoryService.clearChatMemory(sessionId);
      
      this.logger.log(`🧹 Cleared all memory for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to clear memory for session ${sessionId}: ${error}`);
    }
  }

  /**
   * Get memory statistics (equivalent to FastAPI get_memory_stats)
   */
  async getMemoryStats(): Promise<{
    redis: any;
    vector: any;
    totalSessions: number;
  }> {
    try {
      const [redisStats, vectorStats] = await Promise.all([
        this.redisHistoryService.getHistoryStats(),
        this.vectorMemoryService.getMemoryStats(),
      ]);

      return {
        redis: redisStats,
        vector: vectorStats,
        totalSessions: new Set([
          ...redisStats.activeSessions,
          ...Object.keys(vectorStats.sessions)
        ]).size,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get memory stats: ${error}`);
      return {
        redis: { totalSessions: 0, activeSessions: [] },
        vector: { totalSessions: 0, totalMessages: 0, sessions: {} },
        totalSessions: 0,
      };
    }
  }

  /**
   * Add message to appropriate memory based on strategy (equivalent to FastAPI add logic)
   */
  async addMessage(sessionId: string, message: ChatMessage, messageCount: number): Promise<void> {
    try {
      // Always add to Redis for recent access (เหมือน FastAPI)
      if (message.role === 'user') {
        await this.redisHistoryService.addUserMessage(sessionId, message.content);
      } else if (message.role === 'assistant') {
        await this.redisHistoryService.addAIMessage(sessionId, message.content);
      }

      // Add to vector memory if needed (เหมือน FastAPI)
      if (this.shouldEmbedMessages(messageCount)) {
        await this.vectorMemoryService.addChatMemory(sessionId, [message]);
      }

      this.logger.log(`💾 Added message to memory using ${this.getMemoryStrategy(messageCount)} strategy`);
    } catch (error) {
      this.logger.error(`❌ Failed to add message to memory: ${error}`);
    }
  }
} 