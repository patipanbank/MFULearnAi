"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatHistoryService = void 0;
const ChatHistory_1 = require("../models/ChatHistory");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
class ChatHistoryService {
    constructor() {
        this.MAX_PAGE_SIZE = 50;
        this.DEFAULT_PAGE_SIZE = 10;
    }
    validatePagination(page, limit) {
        return {
            page: Math.max(1, page),
            limit: Math.min(Math.max(1, limit), this.MAX_PAGE_SIZE)
        };
    }
    async getChatHistory(userId, page = 1, limit = this.DEFAULT_PAGE_SIZE) {
        try {
            const { page: validPage, limit: validLimit } = this.validatePagination(page, limit);
            const skip = (validPage - 1) * validLimit;
            const total = await ChatHistory_1.ChatHistory.countDocuments({ userId });
            const totalPages = Math.ceil(total / validLimit);
            const histories = await ChatHistory_1.ChatHistory.find({ userId })
                .sort({ isPinned: -1, updatedAt: -1 })
                .skip(skip)
                .limit(validLimit)
                .lean();
            return {
                data: histories,
                total,
                page: validPage,
                totalPages,
                hasMore: validPage < totalPages
            };
        }
        catch (error) {
            console.error('Error getting chat history:', error);
            throw error;
        }
    }
    async getSpecificChat(userId, chatId) {
        try {
            console.log('Getting specific chat:', { userId, chatId });
            const chat = await ChatHistory_1.ChatHistory.findOne({ _id: chatId, userId }).lean();
            if (!chat) {
                throw new Error('Chat not found');
            }
            return chat;
        }
        catch (error) {
            console.error('Error getting specific chat:', error);
            throw new Error(`Failed to get specific chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    validateMessage(msg) {
        if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
            throw new Error('Invalid message role');
        }
        if (!msg.content && (!msg.images || msg.images.length === 0)) {
            throw new Error('Message must have content or images');
        }
        if (msg.content && msg.content.length > 10000) {
            throw new Error('Message content too long (max 10000 characters)');
        }
        if (msg.images) {
            msg.images.forEach((img) => {
                if (!img.data || !img.mediaType) {
                    throw new Error('Invalid image format');
                }
                if (img.data.length > 5242880) { // 5MB
                    throw new Error('Image too large (max 5MB)');
                }
            });
        }
    }
    sanitizeContent(content) {
        return (0, sanitize_html_1.default)(content, {
            allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
            allowedAttributes: {
                'a': ['href']
            }
        });
    }
    async saveChatMessage(userId, modelId, collectionName, messages, chatId) {
        try {
            if (!messages || messages.length === 0) {
                throw new Error('Messages array cannot be empty');
            }
            // Validate messages
            messages.forEach(msg => this.validateMessage(msg));
            const firstUserMessage = messages.find(msg => msg.role === 'user');
            const chatname = firstUserMessage
                ? this.sanitizeContent(firstUserMessage.content.slice(0, 30)) + (firstUserMessage.content.length > 30 ? '...' : '')
                : 'New Chat';
            const processedMessages = messages.map((msg, index) => ({
                id: index + 1,
                role: msg.role,
                content: this.sanitizeContent(String(msg.content)),
                timestamp: new Date(msg.timestamp || Date.now()),
                images: msg.images ? msg.images.map((img) => ({
                    data: img.data,
                    mediaType: img.mediaType
                })) : undefined,
                sources: msg.sources || []
            }));
            console.log('Saving chat message:', {
                userId,
                modelId,
                collectionName,
                chatId,
                messagesCount: messages.length
            });
            let history;
            if (chatId) {
                // Update existing chat
                history = await ChatHistory_1.ChatHistory.findOneAndUpdate({ _id: chatId, userId }, {
                    messages: processedMessages,
                    updatedAt: new Date()
                }, { new: true, runValidators: true });
                if (!history) {
                    throw new Error('Chat not found');
                }
                console.log('Updated existing chat:', history._id);
            }
            else {
                // Create new chat
                history = await ChatHistory_1.ChatHistory.create({
                    userId,
                    modelId,
                    collectionName,
                    chatname,
                    messages: processedMessages
                });
                console.log('Created new chat:', history._id);
            }
            return history;
        }
        catch (error) {
            console.error('Error saving chat message:', error);
            throw error;
        }
    }
    async updateChatName(userId, chatId, newName) {
        try {
            if (!newName.trim()) {
                throw new Error('Chat name cannot be empty');
            }
            const sanitizedName = this.sanitizeContent(newName);
            const chat = await ChatHistory_1.ChatHistory.findOneAndUpdate({ _id: chatId, userId }, { chatname: sanitizedName }, { new: true, runValidators: true });
            if (!chat) {
                throw new Error('Chat not found');
            }
            return chat;
        }
        catch (error) {
            console.error('Error updating chat name:', error);
            throw error;
        }
    }
    async togglePinChat(userId, chatId) {
        try {
            console.log('Toggling pin status:', { userId, chatId });
            const chat = await ChatHistory_1.ChatHistory.findOne({ _id: chatId, userId });
            if (!chat) {
                throw new Error('Chat not found');
            }
            chat.isPinned = !chat.isPinned;
            await chat.save();
            console.log(`Chat ${chatId} pin status toggled to ${chat.isPinned}`);
            return chat;
        }
        catch (error) {
            console.error('Error toggling pin status:', error);
            throw error;
        }
    }
    async clearChatHistory(userId) {
        try {
            const result = await ChatHistory_1.ChatHistory.deleteMany({ userId });
            return {
                success: true,
                message: 'Chat history cleared successfully',
                deletedCount: result.deletedCount
            };
        }
        catch (error) {
            console.error('Error clearing chat history:', error);
            throw error;
        }
    }
    async deleteChatById(userId, chatId) {
        try {
            const result = await ChatHistory_1.ChatHistory.findOneAndDelete({
                _id: chatId,
                userId: userId
            });
            if (!result) {
                throw new Error('Chat not found');
            }
            return {
                success: true,
                message: 'Chat deleted successfully',
                chatId: result._id
            };
        }
        catch (error) {
            console.error('Error deleting chat:', error);
            throw error;
        }
    }
    async searchChatHistory(userId, query, page = 1, limit = this.DEFAULT_PAGE_SIZE) {
        try {
            const { page: validPage, limit: validLimit } = this.validatePagination(page, limit);
            const skip = (validPage - 1) * validLimit;
            const searchRegex = new RegExp(this.sanitizeContent(query), 'i');
            const total = await ChatHistory_1.ChatHistory.countDocuments({
                userId,
                $or: [
                    { chatname: searchRegex },
                    { 'messages.content': searchRegex }
                ]
            });
            const totalPages = Math.ceil(total / validLimit);
            const histories = await ChatHistory_1.ChatHistory.find({
                userId,
                $or: [
                    { chatname: searchRegex },
                    { 'messages.content': searchRegex }
                ]
            })
                .sort({ isPinned: -1, updatedAt: -1 })
                .skip(skip)
                .limit(validLimit)
                .lean();
            return {
                data: histories,
                total,
                page: validPage,
                totalPages,
                hasMore: validPage < totalPages
            };
        }
        catch (error) {
            console.error('Error searching chat history:', error);
            throw error;
        }
    }
}
exports.chatHistoryService = new ChatHistoryService();
