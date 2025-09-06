"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoomService = exports.ChatRoomService = void 0;
const chat_1 = require("../../models/chat");
const memoryService_1 = require("../memoryService");
class ChatRoomService {
    constructor() {
        console.log('✅ Chat room service initialized');
    }
    async createChat(userId, name, agentId) {
        const chat = new chat_1.ChatModel({
            userId,
            name,
            messages: [],
            agentId,
            isPinned: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await chat.save();
        console.log(`✅ Created chat session ${chat._id} for user ${userId}`);
        return chat;
    }
    async getChat(chatId, userId) {
        console.log(`🔍 Looking for chat: ${chatId} for user: ${userId}`);
        const chat = await chat_1.ChatModel.findOne({ _id: chatId, userId });
        if (chat) {
            console.log(`✅ Found chat: ${chatId}`);
        }
        else {
            console.log(`❌ Chat not found: ${chatId}`);
            const chatWithoutUser = await chat_1.ChatModel.findById(chatId);
            if (chatWithoutUser) {
                console.log(`⚠️ Chat exists but belongs to user: ${chatWithoutUser.userId}`);
            }
            else {
                console.log(`❌ Chat doesn't exist in database: ${chatId}`);
            }
        }
        return chat;
    }
    async getUserChats(userId) {
        const chats = await chat_1.ChatModel.find({ userId })
            .sort({ updatedAt: -1 })
            .exec();
        return chats;
    }
    async deleteChat(chatId, userId) {
        const result = await chat_1.ChatModel.deleteOne({ _id: chatId, userId });
        const success = result.deletedCount > 0;
        if (success) {
            console.log(`✅ Deleted chat ${chatId} for user ${userId}`);
            try {
                await memoryService_1.memoryService.clearAllMemory(chatId);
                console.log(`🧹 Cleared memory for deleted chat ${chatId}`);
            }
            catch (err) {
                console.warn(`⚠️ Failed to clear memory for deleted chat ${chatId}:`, err);
            }
        }
        else {
            console.log(`❌ Failed to delete chat ${chatId} for user ${userId}`);
        }
        return success;
    }
    async updateChatName(chatId, userId, name) {
        const chat = await chat_1.ChatModel.findOneAndUpdate({ _id: chatId, userId }, { name, updatedAt: new Date() }, { new: true });
        if (chat) {
            console.log(`📝 Updated chat name for session ${chatId}: ${name}`);
        }
        return chat;
    }
    async updateChatPinStatus(chatId, userId, isPinned) {
        const chat = await chat_1.ChatModel.findOneAndUpdate({ _id: chatId, userId }, { isPinned, updatedAt: new Date() }, { new: true });
        if (chat) {
            console.log(`📌 Updated pin status for session ${chatId}: ${isPinned}`);
        }
        return chat;
    }
}
exports.ChatRoomService = ChatRoomService;
exports.chatRoomService = new ChatRoomService();
//# sourceMappingURL=ChatRoomService.js.map