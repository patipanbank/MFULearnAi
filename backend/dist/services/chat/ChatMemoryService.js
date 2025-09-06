"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatMemoryService = exports.ChatMemoryService = void 0;
const memoryService_1 = require("../memoryService");
class ChatMemoryService {
    constructor() {
        console.log('✅ Chat memory service initialized');
    }
    analyzeMemoryNeeds(messageCount) {
        return {
            messageCount,
            useMemoryTool: this.shouldUseMemoryTool(messageCount),
            useRedisMemory: this.shouldUseRedisMemory(messageCount),
            shouldEmbed: this.shouldEmbedMessages(messageCount)
        };
    }
    async setupHybridMemory(chatId, messages) {
        try {
            console.log(`💾 Setting up hybrid memory for chat ${chatId}`);
            await memoryService_1.memoryService.setupHybridMemory(chatId, messages);
        }
        catch (error) {
            console.warn('⚠️ Hybrid memory setup failed:', error);
        }
    }
    async clearChatMemory(chatId) {
        try {
            await memoryService_1.memoryService.clearAllMemory(chatId);
            if (typeof global.clearChatMemoryTool === 'function') {
                await global.clearChatMemoryTool(chatId);
            }
            console.log(`✅ Memory cleared for chat ${chatId}`);
        }
        catch (error) {
            console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
        }
    }
    shouldUseMemoryTool(messageCount) {
        return messageCount > 10;
    }
    shouldUseRedisMemory(messageCount) {
        return true;
    }
    shouldEmbedMessages(messageCount) {
        return messageCount % 10 === 0;
    }
}
exports.ChatMemoryService = ChatMemoryService;
exports.chatMemoryService = new ChatMemoryService();
//# sourceMappingURL=ChatMemoryService.js.map