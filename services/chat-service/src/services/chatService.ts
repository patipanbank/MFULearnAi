import { ChatModel, Chat, ChatMessage } from '../models/chat';
import logger from '../utils/logger';
import { createChatGraph } from '../graph/chatGraph';
import { ChatState } from '../graph/state/chatState';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import config from '../config/config';
import { randomUUID } from 'crypto';

/**
 * Chat Service
 * Business logic for chat management and message processing
 */
export class ChatService {
  /**
   * Get all chats for a user
   */
  async getUserChats(userId: string): Promise<Chat[]> {
    try {
      const chats = await ChatModel.find({ userId })
        .sort({ isPinned: -1, updatedAt: -1 })
        .select('-messages') // Don't include full message history
        .lean();

      logger.debug('📋 Retrieved user chats', {
        userId,
        count: chats.length,
      });

      return chats as unknown as Chat[];
    } catch (error: any) {
      logger.error('❌ Error getting user chats', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a new chat
   */
  async createChat(
    userId: string,
    name: string,
    agentId?: string
  ): Promise<Chat> {
    try {
      const chat = await ChatModel.create({
        userId,
        name,
        agentId,
        messages: [],
        isPinned: false,
      });

      logger.info('✅ Created new chat', {
        userId,
        chatId: chat._id.toString(),
        name,
        agentId,
      });

      return chat.toObject() as unknown as Chat;
    } catch (error: any) {
      logger.error('❌ Error creating chat', {
        userId,
        name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get a specific chat
   */
  async getChat(chatId: string, userId: string): Promise<Chat | null> {
    try {
      const chat = await ChatModel.findOne({
        _id: chatId,
        userId,
      }).lean();

      if (!chat) {
        logger.warn('⚠️ Chat not found or access denied', {
          chatId,
          userId,
        });
        return null;
      }

      logger.debug('📖 Retrieved chat', {
        chatId,
        userId,
        messageCount: chat.messages?.length || 0,
      });

      return chat as unknown as Chat;
    } catch (error: any) {
      logger.error('❌ Error getting chat', {
        chatId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update chat name
   */
  async updateChatName(
    chatId: string,
    userId: string,
    name: string
  ): Promise<Chat | null> {
    try {
      const chat = await ChatModel.findOneAndUpdate(
        { _id: chatId, userId },
        { name, updatedAt: new Date() },
        { new: true }
      ).lean();

      if (!chat) {
        logger.warn('⚠️ Chat not found or access denied', {
          chatId,
          userId,
        });
        return null;
      }

      logger.info('✅ Updated chat name', {
        chatId,
        userId,
        name,
      });

      return chat as unknown as Chat;
    } catch (error: any) {
      logger.error('❌ Error updating chat name', {
        chatId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update chat
   */
  async updateChat(
    chatId: string,
    userId: string,
    updates: {
      name?: string;
      messages?: ChatMessage[];
      agentId?: string;
    }
  ): Promise<Chat | null> {
    try {
      const chat = await ChatModel.findOneAndUpdate(
        { _id: chatId, userId },
        { ...updates, updatedAt: new Date() },
        { new: true }
      ).lean();

      if (!chat) {
        logger.warn('⚠️ Chat not found or access denied', {
          chatId,
          userId,
        });
        return null;
      }

      logger.info('✅ Updated chat', {
        chatId,
        userId,
        updates: Object.keys(updates),
      });

      return chat as unknown as Chat;
    } catch (error: any) {
      logger.error('❌ Error updating chat', {
        chatId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update chat pin status
   */
  async updateChatPinStatus(
    chatId: string,
    userId: string,
    isPinned: boolean
  ): Promise<Chat | null> {
    try {
      const chat = await ChatModel.findOneAndUpdate(
        { _id: chatId, userId },
        { isPinned, updatedAt: new Date() },
        { new: true }
      ).lean();

      if (!chat) {
        logger.warn('⚠️ Chat not found or access denied', {
          chatId,
          userId,
        });
        return null;
      }

      logger.info('✅ Updated chat pin status', {
        chatId,
        userId,
        isPinned,
      });

      return chat as unknown as Chat;
    } catch (error: any) {
      logger.error('❌ Error updating chat pin status', {
        chatId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a chat
   */
  async deleteChat(chatId: string, userId: string): Promise<boolean> {
    try {
      const result = await ChatModel.deleteOne({
        _id: chatId,
        userId,
      });

      if (result.deletedCount === 0) {
        logger.warn('⚠️ Chat not found or access denied', {
          chatId,
          userId,
        });
        return false;
      }

      logger.info('✅ Deleted chat', {
        chatId,
        userId,
      });

      return true;
    } catch (error: any) {
      logger.error('❌ Error deleting chat', {
        chatId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear chat memory (messages and checkpoints)
   */
  async clearChatMemory(chatId: string): Promise<void> {
    try {
      // Clear messages in MongoDB
      await ChatModel.findByIdAndUpdate(chatId, {
        messages: [],
        updatedAt: new Date(),
      });

      // TODO: Clear checkpoints from Redis/Postgres
      // This requires access to the checkpointer instance
      // For now, we just clear MongoDB messages

      logger.info('✅ Cleared chat memory', {
        chatId,
      });
    } catch (error: any) {
      logger.error('❌ Error clearing chat memory', {
        chatId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add message to chat history
   */
  async addMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, any>
  ): Promise<ChatMessage> {
    try {
      const message: ChatMessage = {
        id: randomUUID(),
        role,
        content,
        timestamp: new Date(),
        metadata,
      };

      await ChatModel.findByIdAndUpdate(
        chatId,
        {
          $push: { messages: message },
          updatedAt: new Date(),
        }
      );

      logger.debug('✅ Added message to chat', {
        chatId,
        role,
        contentLength: content.length,
      });

      return message;
    } catch (error: any) {
      logger.error('❌ Error adding message to chat', {
        chatId,
        role,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process user message with LangGraph
   * This is used by REST API endpoints that don't use WebSocket
   */
  async processMessage(
    chatId: string,
    userId: string,
    message: string,
    agentId?: string
  ): Promise<{
    response: string;
    metadata?: Record<string, any>;
  }> {
    try {
      logger.info('🤖 Processing message with LangGraph', {
        chatId,
        userId,
        messageLength: message.length,
      });

      // Create chat graph
      const chatGraph = await createChatGraph();

      // Initial state
      const initialState: Partial<ChatState> = {
        messages: [new HumanMessage(message)],
        chatId,
        userId,
        sessionId: chatId,
        agentId,
        tools: ['search_memory', 'rag_retrieval', 'calculator'],
        currentIteration: 0,
        maxIterations: config.MAX_ITERATIONS,
        shouldContinue: true,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      // Invoke graph (blocking call)
      const finalState = await chatGraph.invoke(initialState, {
        configurable: {
          thread_id: chatId,
          checkpoint_ns: userId,
        },
      });

      // Extract assistant response
      const lastMessage = finalState.messages[finalState.messages.length - 1];
      const response = lastMessage.content as string;

      // Save messages to MongoDB
      await this.addMessage(chatId, 'user', message);
      await this.addMessage(chatId, 'assistant', response, finalState.metadata);

      logger.info('✅ Message processed successfully', {
        chatId,
        userId,
        responseLength: response.length,
        iterations: finalState.currentIteration,
      });

      return {
        response,
        metadata: finalState.metadata,
      };
    } catch (error: any) {
      logger.error('❌ Error processing message', {
        chatId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get chat statistics
   */
  getStats(): {
    totalChats: number;
    totalMessages: number;
  } {
    // TODO: Implement actual stats aggregation
    // This is a placeholder for the stats endpoint
    return {
      totalChats: 0,
      totalMessages: 0,
    };
  }
}
