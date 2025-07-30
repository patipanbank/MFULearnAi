"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = void 0;
const redis_1 = require("redis");
const chromaService_1 = require("./chromaService");
const embeddingService_1 = require("./embeddingService");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = (0, redis_1.createClient)({ url: redisUrl });
async function ensureRedisConnection() {
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
            console.log('✅ Redis connected successfully');
        }
        catch (error) {
            console.error('❌ Redis connection failed:', error);
            throw error;
        }
    }
}
function isArrayOfMemoryDocs(arr) {
    return Array.isArray(arr) && arr.every(item => typeof item === 'object' && 'document' in item);
}
class MemoryService {
    async addRecentMessage(sessionId, message) {
        try {
            await ensureRedisConnection();
            const key = `chat:recent:${sessionId}`;
            await redisClient.rPush(key, JSON.stringify(message));
            await redisClient.lTrim(key, -10, -1);
        }
        catch (error) {
            console.error(`❌ Error adding recent message: ${error}`);
        }
    }
    async getRecentMessages(sessionId) {
        try {
            await ensureRedisConnection();
            const key = `chat:recent:${sessionId}`;
            const items = await redisClient.lRange(key, 0, -1);
            return items.map((item) => JSON.parse(item));
        }
        catch (error) {
            console.error(`❌ Error getting recent messages: ${error}`);
            return [];
        }
    }
    async clearRecentMessages(sessionId) {
        try {
            await ensureRedisConnection();
            const key = `chat:recent:${sessionId}`;
            await redisClient.del(key);
        }
        catch (error) {
            console.error(`❌ Error clearing recent messages: ${error}`);
        }
    }
    async addLongTermMemory(sessionId, document, embedding, metadata = {}) {
        try {
            await chromaService_1.chromaService.addToCollection(`chat_memory_${sessionId}`, [document], [embedding], [metadata], [Date.now().toString()]);
        }
        catch (error) {
            console.error(`❌ Error adding to long-term memory: ${error}`);
        }
    }
    async searchLongTermMemory(sessionId, queryEmbedding, k = 3) {
        try {
            return await chromaService_1.chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
        }
        catch (error) {
            console.error(`❌ Error searching long-term memory: ${error}`);
            return null;
        }
    }
    async clearLongTermMemory(sessionId) {
        try {
            await chromaService_1.chromaService.deleteCollection(`chat_memory_${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Error clearing long-term memory: ${error}`);
        }
    }
    async embedMessage(sessionId, message) {
        try {
            const embedding = await embeddingService_1.embeddingService.embed(message);
            if (embedding && embedding.length > 0) {
                await this.addLongTermMemory(sessionId, message, embedding, {
                    role: 'user',
                    timestamp: new Date().toISOString(),
                    sessionId
                });
                console.log(`📚 Embedded message to long-term memory for session ${sessionId}`);
            }
            else {
                console.warn(`⚠️ Failed to get embedding for message in session ${sessionId}`);
            }
        }
        catch (error) {
            console.error(`❌ Error embedding message: ${error}`);
            const mockEmbedding = Array(768).fill(0);
            await this.addLongTermMemory(sessionId, message, mockEmbedding, {
                role: 'user',
                timestamp: new Date().toISOString(),
                sessionId
            });
            console.log(`📚 Used mock embedding for session ${sessionId}`);
        }
    }
    async searchMemory(sessionId, query, k = 3) {
        try {
            const queryEmbedding = await embeddingService_1.embeddingService.embed(query);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                console.warn(`⚠️ Failed to get query embedding for session ${sessionId}`);
                return [];
            }
            const results = await this.searchLongTermMemory(sessionId, queryEmbedding, k);
            if (!results)
                return [];
            if (results.documents && Array.isArray(results.documents)) {
                const documents = results.documents.flat();
                const metadatas = results.metadatas?.flat() || [];
                return documents.map((doc, i) => ({
                    content: doc || '',
                    role: metadatas[i]?.role || 'user',
                    timestamp: metadatas[i]?.timestamp || null
                }));
            }
            else if (Array.isArray(results)) {
                return results.map((r) => ({
                    content: r.document ?? '',
                    role: r.metadata?.role || 'user',
                    timestamp: r.metadata?.timestamp || null
                }));
            }
            return [];
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