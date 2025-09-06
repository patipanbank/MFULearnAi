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
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
//# sourceMappingURL=ChatService.js.map