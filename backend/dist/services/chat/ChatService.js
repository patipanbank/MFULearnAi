"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const ChatRoomService_1 = require("./ChatRoomService");
const ChatMessageService_1 = require("./ChatMessageService");
const ChatMemoryService_1 = require("./ChatMemoryService");
const ChatProcessingService_1 = require("./ChatProcessingService");
class ChatService {
    constructor() {
        console.log('✅ Main chat service initialized');
    }
    async createChat(userId, name, agentId) {
        return ChatRoomService_1.chatRoomService.createChat(userId, name, agentId);
    }
    async getChat(chatId, userId) {
        return ChatRoomService_1.chatRoomService.getChat(chatId, userId);
    }
    async getUserChats(userId) {
        return ChatRoomService_1.chatRoomService.getUserChats(userId);
    }
    async deleteChat(chatId, userId) {
        return ChatRoomService_1.chatRoomService.deleteChat(chatId, userId);
    }
    async updateChatName(chatId, userId, name) {
        return ChatRoomService_1.chatRoomService.updateChatName(chatId, userId, name);
    }
    async updateChatPinStatus(chatId, userId, isPinned) {
        return ChatRoomService_1.chatRoomService.updateChatPinStatus(chatId, userId, isPinned);
    }
    async addMessage(chatId, message) {
        return ChatMessageService_1.chatMessageService.addMessage(chatId, message);
    }
    async processMessage(chatId, userId, content, images) {
        return ChatProcessingService_1.chatProcessingService.processMessage(chatId, userId, content, images);
    }
    async clearChatMemory(chatId) {
        return ChatMemoryService_1.chatMemoryService.clearChatMemory(chatId);
    }
    getStats() {
        const processingStats = ChatProcessingService_1.chatProcessingService.getStats();
        return {
            ...processingStats,
        };
    }
    async getChatWithMessages(chatId, userId) {
        try {
            const chat = await this.getChat(chatId, userId);
            if (!chat) {
                return null;
            }
            return {
                ...chat.toObject(),
                messages: chat.messages || []
            };
        }
        catch (error) {
            console.error('Error getting chat with messages:', error);
            throw error;
        }
    }
    async getChatMessages(chatId, userId, options = {}) {
        try {
            const chat = await this.getChat(chatId, userId);
            if (!chat) {
                return [];
            }
            let messages = chat.messages || [];
            if (options.limit) {
                messages = messages.slice(0, options.limit);
            }
            return messages;
        }
        catch (error) {
            console.error('Error getting chat messages:', error);
            return [];
        }
    }
    async updateMessage(messageId, updates) {
        console.log(`Updating message ${messageId} with:`, updates);
        return { id: messageId, ...updates };
    }
    async deleteMessage(messageId) {
        console.log(`Deleting message ${messageId}`);
        return true;
    }
    async searchMessages(query, options = {}) {
        console.log(`Searching messages for: ${query}`);
        return [];
    }
    async updateChat(chatId, updates) {
        console.log(`Updating chat ${chatId} with:`, updates);
        return { id: chatId, ...updates };
    }
    async batchDeleteChats(chatIds) {
        console.log(`Batch deleting chats:`, chatIds);
        return true;
    }
    async batchPinChats(chatIds, pinned) {
        console.log(`Batch ${pinned ? 'pinning' : 'unpinning'} chats:`, chatIds);
        return true;
    }
    async getActiveSessions(userId) {
        return [];
    }
    async createSession(data) {
        return { id: 'session-' + Date.now(), ...data };
    }
    async getSession(sessionId) {
        return { id: sessionId };
    }
    async updateSession(sessionId, updates) {
        return { id: sessionId, ...updates };
    }
    async endSession(sessionId) {
        return true;
    }
    async getSessionStats(sessionId) {
        return { sessionId, stats: {} };
    }
    async transferSession(sessionId, toUserId) {
        return { sessionId, transferredTo: toUserId };
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
//# sourceMappingURL=ChatService.js.map