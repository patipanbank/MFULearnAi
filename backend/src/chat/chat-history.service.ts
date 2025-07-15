import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument, ChatMessage } from '../models/chat.model';
import { VectorMemoryService } from '../memory/vector-memory.service';

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private redisService: any, // Will be injected properly in module
    private vectorMemoryService: VectorMemoryService, // Add vector memory
  ) {}

  /**
   * Add message to chat history (equivalent to FastAPI add_message_to_chat)
   * WITH Smart Memory Management เหมือน FastAPI
   */
  async addMessageToChat(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      this.logger.log(`💬 Adding message to chat ${sessionId}: ${message.role}`);

      // Find and update chat in database
      const chat = await this.chatModel.findById(sessionId);
      if (!chat) {
        this.logger.warn(`⚠️ Chat ${sessionId} not found, creating new chat`);
        
        // Create new chat if not exists (like FastAPI)
        const newChat = new this.chatModel({
          _id: sessionId,
          userId: 'system', // Will be updated when user info is available
          title: 'Generated Chat',
          messages: [message],
          metadata: {
            createdBy: 'system',
            createdAt: new Date(),
          },
        });
        
        await newChat.save();
        this.logger.log(`✅ Created new chat ${sessionId} with message`);
        
        // Smart Memory Management for new chat
        await this.setupSmartMemoryManagement(sessionId, 1);
        return;
      }

      // Add message to existing chat
      chat.messages.push(message);
      chat.updated = new Date();
      
      await chat.save();
      this.logger.log(`✅ Added ${message.role} message to chat ${sessionId}`);

      // Smart Memory Management (เหมือน FastAPI)
      const messageCount = chat.messages.length;
      await this.setupSmartMemoryManagement(sessionId, messageCount);

      // Update Redis cache if service available
      if (this.redisService) {
        try {
          await this.redisService.set(
            `chat:${sessionId}`,
            JSON.stringify(chat),
            3600 // 1 hour TTL
          );
        } catch (redisError) {
          this.logger.warn(`⚠️ Redis cache update failed: ${redisError.message}`);
        }
      }

    } catch (error) {
      this.logger.error(`❌ Failed to add message to chat ${sessionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get chat history (equivalent to FastAPI get_chat_history)
   */
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const chat = await this.chatModel.findById(sessionId);
      if (!chat) {
        this.logger.warn(`⚠️ Chat ${sessionId} not found`);
        return [];
      }

      return chat.messages || [];
    } catch (error) {
      this.logger.error(`❌ Failed to get chat history for ${sessionId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get recent messages (equivalent to FastAPI get_recent_messages)
   */
  async getRecentMessages(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    try {
      const chat = await this.chatModel.findById(sessionId);
      if (!chat || !chat.messages) {
        return [];
      }

      // Return last N messages
      const messages = chat.messages.slice(-limit);
      this.logger.log(`📚 Retrieved ${messages.length} recent messages for ${sessionId}`);
      return messages;
    } catch (error) {
      this.logger.error(`❌ Failed to get recent messages for ${sessionId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Update message (for streaming completion)
   */
  async updateMessage(sessionId: string, messageId: string, updates: Partial<ChatMessage>): Promise<void> {
    try {
      const chat = await this.chatModel.findById(sessionId);
      if (!chat) {
        this.logger.warn(`⚠️ Chat ${sessionId} not found for message update`);
        return;
      }

      const messageIndex = chat.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) {
        this.logger.warn(`⚠️ Message ${messageId} not found in chat ${sessionId}`);
        return;
      }

      // Update message properties
      Object.assign(chat.messages[messageIndex], updates);
      chat.updated = new Date();

      await chat.save();
      this.logger.log(`✅ Updated message ${messageId} in chat ${sessionId}`);

    } catch (error) {
      this.logger.error(`❌ Failed to update message ${messageId} in chat ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Clear chat history (equivalent to FastAPI clear_chat_history)
   */
  async clearChatHistory(sessionId: string): Promise<void> {
    try {
      const chat = await this.chatModel.findById(sessionId);
      if (!chat) {
        this.logger.warn(`⚠️ Chat ${sessionId} not found for clearing`);
        return;
      }

      chat.messages = [];
      chat.updated = new Date();
      
      await chat.save();
      this.logger.log(`🧹 Cleared chat history for ${sessionId}`);

      // Clear Redis cache
      if (this.redisService) {
        try {
          await this.redisService.del(`chat:${sessionId}`);
        } catch (redisError) {
          this.logger.warn(`⚠️ Redis cache clear failed: ${redisError.message}`);
        }
      }

    } catch (error) {
      this.logger.error(`❌ Failed to clear chat history for ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get chat statistics
   */
  async getChatStats(sessionId: string): Promise<{
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    lastActivity: Date | null;
  }> {
    try {
      const chat = await this.chatModel.findById(sessionId);
      if (!chat || !chat.messages) {
        return {
          messageCount: 0,
          userMessages: 0,
          assistantMessages: 0,
          lastActivity: null,
        };
      }

      const messages = chat.messages;
      const userMessages = messages.filter(msg => msg.role === 'user').length;
      const assistantMessages = messages.filter(msg => msg.role === 'assistant').length;
      const lastActivity = messages.length > 0 ? messages[messages.length - 1].timestamp : null;

      return {
        messageCount: messages.length,
        userMessages,
        assistantMessages,
        lastActivity,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get chat stats for ${sessionId}: ${error.message}`);
      return {
        messageCount: 0,
        userMessages: 0,
        assistantMessages: 0,
        lastActivity: null,
      };
    }
  }

  /**
   * Smart Memory Management (equivalent to FastAPI's smart memory setup)
   */
  private async setupSmartMemoryManagement(sessionId: string, messageCount: number): Promise<void> {
    try {
      this.logger.log(`🧠 Setting up smart memory management for ${sessionId} (${messageCount} messages)`);

      // Check if we should embed messages (every 10 messages like FastAPI)
      if (this.vectorMemoryService.shouldEmbedMessages(messageCount)) {
        this.logger.log(`🔄 Embedding messages for session ${sessionId} (message count: ${messageCount})`);
        
        // Get chat and convert messages to format expected by vector memory
        const chat = await this.chatModel.findById(sessionId);
        if (chat && chat.messages) {
          const messagesForMemory = chat.messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
          }));

          // Add to vector memory
          await this.vectorMemoryService.addChatMemory(sessionId, messagesForMemory);
          this.logger.log(`📚 Embedded ${messagesForMemory.length} messages to vector memory for session ${sessionId}`);
        }
      }

      // Use memory tool if available (for long conversations like FastAPI)
      if (this.vectorMemoryService.shouldUseMemoryTool(messageCount)) {
        this.logger.log(`🔍 Vector memory available for session ${sessionId} (${messageCount} messages)`);
      } else {
        this.logger.log(`💾 Using Redis memory only for session ${sessionId} (${messageCount} messages)`);
      }

    } catch (error) {
      this.logger.warn(`⚠️ Failed to setup smart memory management: ${error}`);
    }
  }

  /**
   * Restore Redis memory from database (equivalent to FastAPI memory restoration)
   */
  async restoreRedisMemory(sessionId: string, limit: number = 10): Promise<void> {
    try {
      this.logger.log(`🔄 Restoring Redis memory for session ${sessionId}`);

      const recentMessages = await this.getRecentMessages(sessionId, limit);
      
      if (recentMessages.length > 0 && this.redisService) {
        // Restore Redis cache with recent messages (like FastAPI)
        try {
          await this.redisService.set(
            `chat_history:${sessionId}`,
            JSON.stringify(recentMessages),
            86400 // 24 hours TTL like FastAPI
          );
          this.logger.log(`💾 Restored ${recentMessages.length} messages to Redis memory`);
        } catch (redisError) {
          this.logger.warn(`❌ Failed to restore Redis memory: ${redisError}`);
        }
      }

    } catch (error) {
      this.logger.error(`❌ Error restoring Redis memory: ${error}`);
    }
  }

  /**
   * Get chat history for user (equivalent to FastAPI get_chat_history_for_user)
   */
  async getChatHistoryForUser(userId: string): Promise<Chat[]> {
    try {
      const chats = await this.chatModel
        .find({ userId })
        .sort({ updated: -1 })
        .exec();

      return chats;
    } catch (error) {
      this.logger.error(`❌ Failed to get chat history for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Update chat name (equivalent to FastAPI update_chat_name)
   */
  async updateChatName(sessionId: string, name: string): Promise<Chat | null> {
    try {
      const chat = await this.chatModel.findByIdAndUpdate(
        sessionId,
        { title: name, updated: new Date() },
        { new: true }
      );

      if (chat) {
        this.logger.log(`✅ Updated chat name for ${sessionId}: ${name}`);
      }
      
      return chat;
    } catch (error) {
      this.logger.error(`❌ Failed to update chat name for ${sessionId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Update chat pin status (equivalent to FastAPI update_chat_pin_status)
   */
  async updateChatPinStatus(sessionId: string, isPinned: boolean): Promise<Chat | null> {
    try {
      const chat = await this.chatModel.findByIdAndUpdate(
        sessionId,
        { isPinned, updated: new Date() },
        { new: true }
      );

      if (chat) {
        this.logger.log(`✅ Updated pin status for ${sessionId}: ${isPinned}`);
      }
      
      return chat;
    } catch (error) {
      this.logger.error(`❌ Failed to update pin status for ${sessionId}: ${error.message}`);
      return null;
    }
  }
} 