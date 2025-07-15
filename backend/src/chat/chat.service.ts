import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from '../models/chat.model';
import { User } from '../models/user.model';
import { RedisService } from '../redis/redis.service';
import { ChatMemoryService } from './chat-memory.service';
import { MemoryToolService } from './memory-tool.service';

export interface CreateChatDto {
  title?: string;
  agentId?: string;
  department?: string;
  isPrivate?: boolean;
}

export interface SendMessageDto {
  content: string;
  role?: 'user' | 'assistant';
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface GetChatsQuery {
  userId?: string;
  agentId?: string;
  department?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private redisService: RedisService,
    private chatMemoryService: ChatMemoryService,
    private memoryToolService: MemoryToolService,
  ) {}

  async createChat(userId: string, createChatDto: CreateChatDto): Promise<Chat> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const chat = new this.chatModel({
        userId,
        title: createChatDto.title || 'New Chat',
        agentId: createChatDto.agentId,
        department: createChatDto.department || user.department,
        isPrivate: createChatDto.isPrivate || false,
        messages: [],
        metadata: {
          createdBy: userId,
          createdAt: new Date(),
        },
      });

      const savedChat = await chat.save();
      
      // Cache chat in Redis
      await this.redisService.set(
        `chat:${savedChat._id}`,
        JSON.stringify(savedChat),
        3600 // 1 hour
      );

      return savedChat;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to create chat');
    }
  }

  async sendMessage(
    chatId: string,
    userId: string,
    messageDto: SendMessageDto,
  ): Promise<Chat> {
    try {
      const chat = await this.chatModel.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Check if user has access to this chat
      if (chat.userId.toString() !== userId) {
        throw new BadRequestException('Access denied');
      }

      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: messageDto.content,
        role: messageDto.role || 'user',
        timestamp: new Date(),
        isStreaming: false,
        isComplete: true,
        metadata: messageDto.metadata || {},
      };

      chat.messages.push(message);
      chat.updated = new Date();

      const savedChat = await chat.save();

      // Update Redis cache
      await this.redisService.set(
        `chat:${chatId}`,
        JSON.stringify(savedChat),
        3600
      );

      // Publish message to Redis for real-time updates
      await this.redisService.publishChatMessage(chatId, message);

      // ==================================================
      // Memory Management (เหมือน FastAPI)
      // ==================================================
      
      // Add message to Redis memory (last 10 messages)
      if (messageDto.role === 'user') {
        await this.chatMemoryService.addUserMessage(chatId, messageDto.content);
      } else if (messageDto.role === 'assistant') {
        await this.chatMemoryService.addAiMessage(chatId, messageDto.content);
      }

      // Check if we should embed messages (every 10 messages like FastAPI)
      const messageCount = chat.messages.length;
      if (this.memoryToolService.shouldEmbedMessages(messageCount)) {
        // Convert messages to format expected by memory tool
        const messagesForMemory = chat.messages.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
        }));

        // Add to memory tool (vector embeddings)
        await this.memoryToolService.addChatMemory(chatId, messagesForMemory);
      }

      return savedChat;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to send message');
    }
  }

  async getChats(query: GetChatsQuery): Promise<{ chats: Chat[]; total: number }> {
    try {
      const filter: any = {};
      
      if (query.userId) {
        filter.userId = query.userId;
      }
      
      if (query.agentId) {
        filter.agentId = query.agentId;
      }
      
      if (query.department) {
        filter.department = query.department;
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [chats, total] = await Promise.all([
        this.chatModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'username email role')
          .exec(),
        this.chatModel.countDocuments(filter),
      ]);

      return { chats, total };
    } catch (error) {
      throw new BadRequestException('Failed to get chats');
    }
  }

  async getChatById(chatId: string, userId: string): Promise<Chat> {
    try {
      // Try to get from cache first
      const cachedChat = await this.redisService.get(`chat:${chatId}`);
      if (cachedChat) {
        const chat = JSON.parse(cachedChat as string);
        if (chat.userId === userId) {
          return chat;
        }
      }

      const chat = await this.chatModel
        .findById(chatId)
        .populate('userId', 'username email role')
        .exec();

      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Check access permissions
      if (chat.userId.toString() !== userId) {
        throw new BadRequestException('Access denied');
      }

      // Cache the chat
      await this.redisService.set(
        `chat:${chatId}`,
        JSON.stringify(chat),
        3600
      );

      return chat;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to get chat');
    }
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    try {
      const chat = await this.chatModel.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      if (chat.userId.toString() !== userId) {
        throw new BadRequestException('Access denied');
      }

      await this.chatModel.findByIdAndDelete(chatId);
      
      // Remove from Redis cache
      await this.redisService.del(`chat:${chatId}`);

      // Clear memory when deleting chat (เหมือน FastAPI)
      await this.clearChatMemory(chatId, userId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete chat');
    }
  }

  async getChatHistory(chatId: string, userId: string): Promise<any[]> {
    const chat = await this.getChatById(chatId, userId);
    return chat.messages || [];
  }

  async updateChatTitle(chatId: string, userId: string, title: string): Promise<Chat> {
    try {
      const chat = await this.chatModel.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      if (chat.userId.toString() !== userId) {
        throw new BadRequestException('Access denied');
      }

      chat.title = title;
      chat.updated = new Date();
      
      const savedChat = await chat.save();

      // Update Redis cache
      await this.redisService.set(
        `chat:${chatId}`,
        JSON.stringify(savedChat),
        3600
      );

      return savedChat;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update chat title');
    }
  }

  async getUserChatStats(userId: string): Promise<any> {
    try {
      const totalChats = await this.chatModel.countDocuments({ userId });
      const totalMessages = await this.chatModel.aggregate([
        { $match: { userId } },
        { $project: { messageCount: { $size: '$messages' } } },
        { $group: { _id: null, total: { $sum: '$messageCount' } } },
      ]);

      // Get memory stats from both Redis and Memory Tool
      const redisMemoryStats = await this.chatMemoryService.getMemoryStats();
      const memoryToolStats = await this.memoryToolService.getMemoryStats();

      return {
        totalChats,
        totalMessages: totalMessages[0]?.total || 0,
        redisMemory: redisMemoryStats,
        memoryTool: memoryToolStats,
      };
    } catch (error) {
      throw new BadRequestException('Failed to get user chat stats');
    }
  }

  // ==================================================
  // Clear Memory - เหมือน FastAPI ทุกประการ
  // ==================================================
  
  /**
   * Clear chat memory (เหมือน clear_chat_memory ใน FastAPI)
   * ล้างทั้ง Redis memory และ Memory Tool แต่ไม่ลบประวัติข้อความใน database
   */
  async clearChatMemory(chatId: string, userId: string): Promise<void> {
    try {
      // ตรวจสอบสิทธิ์ (เหมือน FastAPI)
      const chat = await this.chatModel.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      if (chat.userId.toString() !== userId) {
        throw new BadRequestException('Not authorized to clear memory for this chat');
      }

      // 1. Clear Redis memory (เหมือน history.clear() ใน FastAPI)
      await this.chatMemoryService.clear(chatId);

      // 2. Clear Memory Tool (เหมือน clear_memory_tool(session_id) ใน FastAPI)
      await this.memoryToolService.clearChatMemory(chatId);

      console.log(`🧹 Cleared all memory for chat ${chatId} (Redis + Memory Tool)`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to clear chat memory');
    }
  }

  /**
   * Restore Redis memory from database (เหมือน FastAPI restore logic)
   */
  async restoreRedisMemoryFromHistory(chatId: string): Promise<void> {
    try {
      const chat = await this.chatModel.findById(chatId);
      if (!chat || !chat.messages) {
        return;
      }

      // Check if Redis memory exists
      const hasMemory = await this.chatMemoryService.hasMemory(chatId);
      if (hasMemory) {
        return; // Memory already exists
      }

      // Convert database messages to memory format
      const memoryMessages = chat.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.timestamp,
        id: msg.id,
      }));

      // Restore Redis memory with recent messages (last 10)
      await this.chatMemoryService.restoreFromHistory(chatId, memoryMessages);

    } catch (error) {
      console.error(`Failed to restore Redis memory for chat ${chatId}:`, error);
    }
  }

  /**
   * Get memory statistics (เหมือน get_memory_stats ใน FastAPI)
   */
  async getMemoryStats(): Promise<any> {
    try {
      const redisStats = await this.chatMemoryService.getMemoryStats();
      const memoryToolStats = await this.memoryToolService.getMemoryStats();

      return {
        redis: redisStats,
        memoryTool: memoryToolStats,
        combined: {
          totalSessions: Math.max(redisStats.totalSessions, memoryToolStats.totalSessions),
          totalMessages: redisStats.totalMessages + memoryToolStats.totalMessages,
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to get memory stats');
    }
  }

  /**
   * Pin/Unpin chat (เหมือน pin_chat ใน FastAPI)
   */
  async pinChat(chatId: string, userId: string, isPinned: boolean): Promise<Chat> {
    try {
      const chat = await this.chatModel.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Check if user has access to this chat
      if (chat.userId.toString() !== userId) {
        throw new BadRequestException('Access denied');
      }

      // Update pin status
      chat.isPinned = isPinned;
      chat.updated = new Date();

      const savedChat = await chat.save();

      // Update Redis cache
      await this.redisService.set(
        `chat:${chatId}`,
        JSON.stringify(savedChat),
        3600
      );

      return savedChat;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to pin/unpin chat');
    }
  }

  /**
   * Generate response using LangChain (equivalent to FastAPI chat service)
   * This method is used by TaskQueueService for background processing
   */
  async *generateResponse(request: {
    sessionId: string;
    userId: string;
    message: string;
    modelId: string;
    collectionNames: string[];
    agentId?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    images?: any[];
  }): AsyncGenerator<string, void, unknown> {
    try {
      // Import LangChain service dynamically to avoid circular dependencies
      const { LangChainChatService } = await import('../langchain/langchain-chat.service');
      const langchainService = new LangChainChatService();

      // Create chat request for LangChain
      const chatRequest = {
        sessionId: request.sessionId,
        userId: request.userId,
        message: request.message,
        modelId: request.modelId,
        collectionNames: request.collectionNames,
        agentId: request.agentId,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature || 0.7,
        maxTokens: request.maxTokens || 4000,
        images: request.images || [],
      };

      // Stream response from LangChain (like FastAPI)
      for await (const chunk of langchainService.chat(chatRequest)) {
        yield chunk;
      }

    } catch (error) {
      // Send error in the same format as successful responses
      yield JSON.stringify({
        type: 'error',
        data: `Failed to generate response: ${error.message}`
      });
    }
  }
} 