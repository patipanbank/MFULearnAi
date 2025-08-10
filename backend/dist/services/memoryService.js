"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = void 0;
const chromaService_1 = require("./chromaService");
const embeddingService_1 = require("./embeddingService");
const redis_1 = require("../lib/redis");
function isArrayOfMemoryDocs(arr) {
    return Array.isArray(arr) && arr.every(item => typeof item === 'object' && 'document' in item);
}
class MemoryService {
    async addRecentMessage(sessionId, message) {
        try {
            const key = `chat:recent:${sessionId}`;
            await redis_1.redis.rpush(key, JSON.stringify(message));
            await redis_1.redis.ltrim(key, -10, -1);
        }
        catch (error) {
            console.error(`❌ Error adding recent message: ${error}`);
        }
    }
    async getRecentMessages(sessionId) {
        try {
            const key = `chat:recent:${sessionId}`;
            const items = await redis_1.redis.lrange(key, 0, -1);
            return items.map((item) => JSON.parse(item));
        }
        catch (error) {
            console.error(`❌ Error getting recent messages: ${error}`);
            return [];
        }
    }
    async clearRecentMessages(sessionId) {
        try {
            const key = `chat:recent:${sessionId}`;
            await redis_1.redis.del(key);
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
            const contentHash = Buffer.from(message).toString('base64');
            const collectionName = `chat_memory_${sessionId}`;
            const exists = await chromaService_1.chromaService.documentExists(collectionName, contentHash);
            if (exists) {
                console.log(`🔁 Skip embedding duplicate content for session ${sessionId}`);
                return;
            }
            const embedding = await embeddingService_1.embeddingService.embed(message);
            if (embedding && embedding.length > 0) {
                await chromaService_1.chromaService.addToCollection(collectionName, [message], [embedding], [{
                        role: 'user',
                        timestamp: new Date().toISOString(),
                        sessionId
                    }], [contentHash]);
                console.log(`📚 Embedded message to long-term memory for session ${sessionId}`);
            }
            else {
                console.warn(`⚠️ Failed to get embedding for message in session ${sessionId}`);
            }
        }
        catch (error) {
            console.error(`❌ Error embedding message: ${error}`);
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
            const collectionName = `chat_memory_${sessionId}`;
            const candidates = messages
                .filter(m => typeof m?.content === 'string' && m.content.trim().length > 0)
                .slice(-10);
            if (candidates.length > 0) {
                const prepared = await Promise.all(candidates.map(async (m) => {
                    const id = Buffer.from(m.content).toString('base64');
                    const exists = await chromaService_1.chromaService.documentExists(collectionName, id);
                    return exists ? null : { id, content: m.content, metadata: { role: m.role, timestamp: new Date().toISOString(), sessionId } };
                }));
                const toInsert = prepared.filter(Boolean);
                if (toInsert.length > 0) {
                    const embeddings = await embeddingService_1.embeddingService.embedBatch(toInsert.map(i => i.content));
                    await chromaService_1.chromaService.addToCollection(collectionName, toInsert.map(i => i.content), embeddings, toInsert.map(i => i.metadata), toInsert.map(i => i.id));
                    console.log(`📚 Embedded ${toInsert.length} new messages to vectorstore`);
                }
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