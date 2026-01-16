import { Chat } from '../../models/Chat';
import { NotFoundError, BadRequestError } from '../../errors';
import { PaginatedResponse } from '../../types/common';

/**
 * Repository service for Chat CRUD operations
 */
export class ChatRepositoryService {
  /**
   * Validate MongoDB ObjectId format
   */
  private isValidObjectId(id: string | null): boolean {
    if (!id) return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Get chats with pagination
   */
  async getChats(userId: string, page: number = 1, limit: number = 5): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;
    const [chats, total] = await Promise.all([
      Chat.find({ userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Chat.countDocuments({ userId }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      data: chats,
      page,
      limit,
      total,
      totalPages,
      hasMore,
    };
  }

  /**
   * Get single chat by ID
   */
  async getChat(userId: string, chatId: string) {
    if (!this.isValidObjectId(chatId)) {
      throw new BadRequestError('Invalid chat ID format');
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      throw new NotFoundError('Chat not found');
    }
    return chat;
  }

  /**
   * Save new chat
   */
  async saveChat(userId: string, modelId: string, messages: any[]) {
    const firstUserMessage = messages.find((msg) => msg.role === 'user');
    const chatname = firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'Untitled Chat';

    const lastMessage = messages[messages.length - 1];
    const name = lastMessage.content.substring(0, 50);

    const processedMessages = messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp?.$date ? new Date(msg.timestamp.$date) : new Date(),
      images: msg.images || [],
      sources: msg.sources || [],
      isImageGeneration: msg.isImageGeneration || false,
      isComplete: msg.isComplete || false,
    }));

    const chat = new Chat({
      userId,
      modelId,
      chatname,
      name,
      messages: processedMessages,
    });

    await chat.save();
    return chat;
  }

  /**
   * Update existing chat
   */
  async updateChat(chatId: string, userId: string, messages: any[]) {
    if (!this.isValidObjectId(chatId)) {
      throw new BadRequestError('Invalid chat ID format');
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId },
      {
        $set: {
          name: messages[messages.length - 1].content.substring(0, 50),
          messages: messages.map((msg) => ({
            ...msg,
            timestamp: msg.timestamp?.$date ? new Date(msg.timestamp.$date) : new Date(),
            images: msg.images || [],
            sources: msg.sources || [],
            isImageGeneration: msg.isImageGeneration || false,
            isComplete: msg.isComplete || false,
          })),
        },
      },
      { new: true }
    );

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    return chat;
  }

  /**
   * Delete chat
   */
  async deleteChat(chatId: string, userId: string) {
    if (!this.isValidObjectId(chatId)) {
      throw new BadRequestError('Invalid chat ID format');
    }

    const result = await Chat.deleteOne({ _id: chatId, userId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Chat not found or unauthorized');
    }
    return true;
  }

  /**
   * Toggle pin status
   */
  async togglePinChat(chatId: string, userId: string) {
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    chat.isPinned = !chat.isPinned;
    await chat.save();
    return chat;
  }
}

export const chatRepositoryService = new ChatRepositoryService();
