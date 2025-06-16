"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = void 0;
const Chat_1 = require("../models/Chat");
class ChatService {
    async getChats(userId, page = 1, limit = 20) {
        try {
            const skip = (page - 1) * limit;
            const [chats, total] = await Promise.all([
                Chat_1.Chat.find({ userId })
                    .sort({ updatedAt: -1 })
                    .skip(skip)
                    .limit(limit),
                Chat_1.Chat.countDocuments({ userId })
            ]);
            return {
                data: chats,
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + chats.length < total
            };
        }
        catch (error) {
            console.error('Error getting chats:', error);
            throw new Error(`Failed to get chats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getChat(userId, chatId) {
        try {
            const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
            if (!chat) {
                throw new Error('Chat not found');
            }
            return chat;
        }
        catch (error) {
            console.error('Error getting chat:', error);
            throw new Error(`Failed to get chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async saveChat(userId, modelId, messages, chatId, chatname) {
        try {
            if (!userId || !modelId) {
                throw new Error('userId and modelId are required');
            }
            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                throw new Error('Messages array is required and must not be empty');
            }
            // Process messages
            const processedMessages = messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp?.$date || msg.timestamp || new Date()),
                role: msg.role,
                content: msg.content || '',
                images: msg.images || [],
                isImageGeneration: msg.isImageGeneration || false
            }));
            // Generate chat name from first user message if not provided
            const finalChatname = chatname || (() => {
                const firstUserMessage = messages.find(msg => msg.role === 'user');
                if (!firstUserMessage)
                    return "New Chat";
                const content = firstUserMessage.content.trim();
                return content.length > 50 ? content.substring(0, 47) + "..." : content;
            })();
            // Update or create chat
            if (chatId) {
                const chat = await Chat_1.Chat.findOneAndUpdate({ _id: chatId, userId }, {
                    messages: processedMessages,
                    updatedAt: new Date()
                }, { new: true, runValidators: true });
                if (!chat) {
                    throw new Error('Chat not found or unauthorized');
                }
                return chat;
            }
            // Create new chat
            const chat = await Chat_1.Chat.create({
                userId,
                modelId,
                chatname: finalChatname,
                messages: processedMessages
            });
            return chat;
        }
        catch (error) {
            console.error('Error in saveChat:', error);
            throw new Error(`Failed to save chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async deleteChat(userId, chatId) {
        try {
            const result = await Chat_1.Chat.findOneAndDelete({ _id: chatId, userId });
            if (!result) {
                throw new Error('Chat not found or unauthorized');
            }
            return { success: true, message: 'Chat deleted successfully' };
        }
        catch (error) {
            console.error('Error deleting chat:', error);
            throw new Error(`Failed to delete chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async togglePinChat(userId, chatId) {
        const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
        if (!chat) {
            throw new Error('Chat not found');
        }
        chat.isPinned = !chat.isPinned;
        await chat.save();
        return chat;
    }
}
exports.chatService = new ChatService();
