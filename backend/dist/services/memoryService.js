"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = void 0;
const redis_1 = require("redis");
const chromaService_1 = require("./chromaService");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = (0, redis_1.createClient)({ url: redisUrl });
redisClient.connect().catch(console.error);
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
        const embedding = Array(768).fill(0);
        await this.addLongTermMemory(sessionId, message, embedding, { role: 'user' });
    }
    async searchMemory(sessionId, query, k = 3) {
        const queryEmbedding = Array(768).fill(0);
        const results = await this.searchLongTermMemory(sessionId, queryEmbedding, k);
        return (results || []).map((r) => ({
            content: r.document,
            role: r.metadata?.role || 'user',
            timestamp: r.metadata?.timestamp || null
        }));
    }
    async getAllMessages(sessionId) {
        const results = await chromaService_1.chromaService.getAllFromCollection(`chat_memory_${sessionId}`);
        if (!Array.isArray(results))
            return [];
        return results.map((r) => ({
            content: r.document ?? '',
            role: r.metadata?.role || 'user',
            timestamp: r.metadata?.timestamp || null
        }));
    }
}
exports.MemoryService = MemoryService;
exports.memoryService = new MemoryService();
//# sourceMappingURL=memoryService.js.map