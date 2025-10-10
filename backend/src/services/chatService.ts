import { Chat, IChatDocument, IMessageDocument } from '../models/Chat';
import { aiService } from './aiService';
import { NotFoundError, ValidationError } from '../types';
import { redis } from '../lib/redis';

export class ChatService {
  async createChat(userId: string, title: string = 'New Chat'): Promise<IChatDocument> {
    const chat = await Chat.create({
      userId,
      title,
      messages: [],
    });

    return chat;
  }

  async getUserChats(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ chats: IChatDocument[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [chats, total] = await Promise.all([
      Chat.find({ userId, isActive: true })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Chat.countDocuments({ userId, isActive: true }),
    ]);

    return {
      chats: chats as IChatDocument[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getChatById(chatId: string, userId: string): Promise<IChatDocument> {
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    return chat;
  }

  async addMessage(
    chatId: string,
    userId: string,
    message: string,
    role: 'user' | 'assistant' | 'system' = 'user'
  ): Promise<IChatDocument> {
    const chat = await this.getChatById(chatId, userId);

    const newMessage: IMessageDocument = {
      role,
      content: message,
      timestamp: new Date(),
    };

    chat.messages.push(newMessage);
    await chat.save();

    // Cache recent messages in Redis
    await this.cacheRecentMessages(chatId, chat.messages);

    return chat;
  }

  async sendMessage(
    chatId: string,
    userId: string,
    message: string,
    systemPrompt?: string
  ): Promise<{ chat: IChatDocument; response: string }> {
    if (!message || message.trim().length === 0) {
      throw new ValidationError('Message cannot be empty');
    }

    // Add user message
    let chat = await this.addMessage(chatId, userId, message, 'user');

    // Prepare messages for AI
    const aiMessages = chat.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // Generate AI response
    const aiResponse = await aiService.generateResponse({
      messages: aiMessages,
      systemPrompt,
    });

    // Add AI response to chat
    chat = await this.addMessage(chatId, userId, aiResponse.content, 'assistant');

    return {
      chat,
      response: aiResponse.content,
    };
  }

  async *streamMessage(
    chatId: string,
    userId: string,
    message: string,
    systemPrompt?: string
  ): AsyncGenerator<string> {
    if (!message || message.trim().length === 0) {
      throw new ValidationError('Message cannot be empty');
    }

    // Add user message
    const chat = await this.addMessage(chatId, userId, message, 'user');

    // Prepare messages for AI
    const aiMessages = chat.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // Stream AI response
    let fullResponse = '';
    for await (const chunk of aiService.streamResponse({
      messages: aiMessages,
      systemPrompt,
    })) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
        fullResponse += chunk.delta.text;
        yield chunk.delta.text;
      }
    }

    // Save complete AI response
    await this.addMessage(chatId, userId, fullResponse, 'assistant');
  }

  async updateChatTitle(chatId: string, userId: string, title: string): Promise<IChatDocument> {
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId, isActive: true },
      { $set: { title } },
      { new: true }
    );

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    return chat;
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId, isActive: true },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Remove from cache
    await redis.del(`chat:recent:${chatId}`);
  }

  private async cacheRecentMessages(chatId: string, messages: IMessageDocument[]): Promise<void> {
    try {
      const recentMessages = messages.slice(-10);
      await redis.set(
        `chat:recent:${chatId}`,
        JSON.stringify(recentMessages),
        86400 // 24 hours TTL
      );
    } catch (error) {
      console.error('Failed to cache recent messages:', error);
      // Don't throw - caching failure shouldn't break the flow
    }
  }
}

export const chatService = new ChatService();
