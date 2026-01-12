"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRepositoryService = exports.ChatRepositoryService = void 0;
const Chat_1 = require("../../models/Chat");
const errors_1 = require("../../errors");
/**
 * Repository service for Chat CRUD operations
 */
class ChatRepositoryService {
    /**
     * Validate MongoDB ObjectId format
     */
    isValidObjectId(id) {
        if (!id)
            return false;
        return /^[0-9a-fA-F]{24}$/.test(id);
    }
    /**
     * Get chats with pagination
     */
    async getChats(userId, page = 1, limit = 5) {
        const skip = (page - 1) * limit;
        const [chats, total] = await Promise.all([
            Chat_1.Chat.find({ userId })
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit),
            Chat_1.Chat.countDocuments({ userId }),
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
    async getChat(userId, chatId) {
        if (!this.isValidObjectId(chatId)) {
            throw new errors_1.BadRequestError('Invalid chat ID format');
        }
        const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
        if (!chat) {
            throw new errors_1.NotFoundError('Chat not found');
        }
        return chat;
    }
    /**
     * Save new chat
     */
    async saveChat(userId, modelId, messages) {
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
        const chat = new Chat_1.Chat({
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
    async updateChat(chatId, userId, messages) {
        if (!this.isValidObjectId(chatId)) {
            throw new errors_1.BadRequestError('Invalid chat ID format');
        }
        const chat = await Chat_1.Chat.findOneAndUpdate({ _id: chatId, userId }, {
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
        }, { new: true });
        if (!chat) {
            throw new errors_1.NotFoundError('Chat not found');
        }
        return chat;
    }
    /**
     * Delete chat
     */
    async deleteChat(chatId, userId) {
        if (!this.isValidObjectId(chatId)) {
            throw new errors_1.BadRequestError('Invalid chat ID format');
        }
        const result = await Chat_1.Chat.deleteOne({ _id: chatId, userId });
        if (result.deletedCount === 0) {
            throw new errors_1.NotFoundError('Chat not found or unauthorized');
        }
        return true;
    }
    /**
     * Toggle pin status
     */
    async togglePinChat(chatId, userId) {
        const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
        if (!chat) {
            throw new errors_1.NotFoundError('Chat not found');
        }
        chat.isPinned = !chat.isPinned;
        await chat.save();
        return chat;
    }
}
exports.ChatRepositoryService = ChatRepositoryService;
exports.chatRepositoryService = new ChatRepositoryService();
