"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = void 0;
const redis_1 = require("redis");
const chromaService_1 = require("./chromaService");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = (0, redis_1.createClient)({ url: redisUrl });
redisClient.connect().catch(console.error);
function isArrayOfMemoryDocs(arr) {
    return Array.isArray(arr) && arr.every(item => typeof item === 'object' && 'document' in item);
}
class MemoryService {
    async addRecentMessage(sessionId, message) {
        const key = `chat:recent:${sessionId}`;
        await redisClient.rPush(key, JSON.stringify(message));
        await redisClient.lTrim(key, -10, -1);
    }
    async getRecentMessages(sessionId) {
        const key = `chat:recent:${sessionId}`;
        const items = await redisClient.lRange(key, 0, -1);
        return items.map((item) => JSON.parse(item));
    }
    async clearRecentMessages(sessionId) {
        const key = `chat:recent:${sessionId}`;
        await redisClient.del(key);
    }
    async addLongTermMemory(sessionId, document, embedding, metadata = {}) {
        await chromaService_1.chromaService.addToCollection(`chat_memory_${sessionId}`, [document], [embedding], [metadata], [Date.now().toString()]);
    }
    async searchLongTermMemory(sessionId, queryEmbedding, k = 3) {
        return chromaService_1.chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
    }
    async clearLongTermMemory(sessionId) {
        await chromaService_1.chromaService.deleteCollection(`chat_memory_${sessionId}`);
    }
    async embedMessage(sessionId, message) {
        try {
            const embedding = Array(768).fill(0);
            await this.addLongTermMemory(sessionId, message, embedding, {
                role: 'user',
                timestamp: new Date().toISOString(),
                sessionId
            });
            console.log(`📚 Embedded message to long-term memory for session ${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Error embedding message: ${error}`);
        }
    }
    async searchMemory(sessionId, query, k = 3) {
        try {
            const queryEmbedding = Array(768).fill(0);
            const results = await this.searchLongTermMemory(sessionId, queryEmbedding, k);
            if (!results || !results.documents)
                return [];
            return results.documents.flat().map((doc, i) => ({
                content: doc || '',
                role: results.metadatas?.[i]?.role || 'user',
                timestamp: results.metadatas?.[i]?.timestamp || null
            }));
        }
        catch (error) {
            console.error(`❌ Error searching memory: ${error}`);
            return [];
        }
    }
    async getAllMessages(sessionId) {
        try {
            const results = await chromaService_1.chromaService.getAllFromCollection(`chat_memory_${sessionId}`);
            if (!Array.isArray(results))
                return [];
            return results.map((r) => ({
                content: r.document ?? '',
                role: r.metadata?.role || 'user',
                timestamp: r.metadata?.timestamp || null
            }));
        }
        catch (error) {
            console.error(`❌ Error getting all messages: ${error}`);
            return [];
        }
    }
    async setupHybridMemory(sessionId, messages) {
        try {
            console.log(`🧠 Setting up hybrid memory for session ${sessionId}`);
            const recentMessages = messages.slice(-10);
            if (recentMessages.length > 0) {
                for (const msg of recentMessages) {
                    await this.addRecentMessage(sessionId, msg);
                }
                console.log(`💾 Stored ${recentMessages.length} recent messages in Redis`);
            }
            if (messages.length % 10 === 0 && messages.length > 0) {
                const messagesForEmbedding = messages.map(msg => ({
                    content: msg.content,
                    role: msg.role,
                    timestamp: new Date().toISOString()
                }));
                for (const msg of messagesForEmbedding) {
                    await this.embedMessage(sessionId, msg.content);
                }
                console.log(`📚 Embedded ${messagesForEmbedding.length} messages to vectorstore`);
            }
        }
        catch (error) {
            console.error(`❌ Error setting up hybrid memory: ${error}`);
        }
    }
    async getMemoryStats(sessionId) {
        try {
            const recent = await this.getRecentMessages(sessionId);
            const all = await this.getAllMessages(sessionId);
            return {
                sessionId,
                recentCount: recent.length,
                totalCount: all.length,
                hybridMemory: true
            };
        }
        catch (error) {
            console.error(`❌ Error getting memory stats: ${error}`);
            return { error: 'Memory stats unavailable' };
        }
    }
    async clearAllMemory(sessionId) {
        try {
            await this.clearRecentMessages(sessionId);
            await this.clearLongTermMemory(sessionId);
            console.log(`🧹 Cleared all memory for session ${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Error clearing memory: ${error}`);
        }
    }
}
exports.MemoryService = MemoryService;
exports.memoryService = new MemoryService();
//# sourceMappingURL=memoryService.js.map