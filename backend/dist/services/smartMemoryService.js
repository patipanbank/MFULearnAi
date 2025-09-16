"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartMemoryService = exports.SmartMemoryService = void 0;
const chromaService_1 = require("./chromaService");
const embeddingService_1 = require("./embeddingService");
const redis_1 = require("../lib/redis");
class SmartMemoryService {
    constructor() {
        this.RECENT_MESSAGE_LIMIT = 15;
        this.MIN_RELEVANCE_SCORE = 0.75;
        this.CONTEXT_TOKEN_LIMIT = 3000;
    }
    async addMessage(sessionId, message) {
        try {
            await this.addToRecentCache(sessionId, message);
            if (this.shouldEmbed(message)) {
                await this.embedMessage(sessionId, message);
            }
        }
        catch (error) {
            console.error(`❌ Error adding message to smart memory: ${error}`);
            throw error;
        }
    }
    async getConversationContext(sessionId, query) {
        try {
            const recentMessages = await this.getRecentMessages(sessionId);
            if (query && query.trim().length > 10) {
                const relevantMessages = await this.searchRelevantMessages(sessionId, query);
                return this.mergeMessages(recentMessages, relevantMessages);
            }
            return recentMessages;
        }
        catch (error) {
            console.error(`❌ Error getting conversation context: ${error}`);
            return [];
        }
    }
    async searchMemory(sessionId, query, limit = 5) {
        try {
            if (!query?.trim() || query.length < 5) {
                return [];
            }
            const queryEmbedding = await embeddingService_1.embeddingService.embed(query);
            if (!queryEmbedding || queryEmbedding.length === 0)
                return [];
            const results = await chromaService_1.chromaService.queryCollection(`smart_memory_${sessionId}`, [queryEmbedding], limit * 2);
            if (!results?.documents || !results?.distances || !results?.metadatas) {
                return [];
            }
            const processedResults = [];
            const documents = results.documents.flat();
            const distances = results.distances.flat();
            const metadatas = results.metadatas.flat();
            for (let i = 0; i < documents.length && processedResults.length < limit; i++) {
                const relevanceScore = Math.max(0, 1 - (distances[i] || 1));
                if (relevanceScore >= this.MIN_RELEVANCE_SCORE) {
                    const metadata = metadatas[i];
                    processedResults.push({
                        content: String(documents[i] || ''),
                        role: String(metadata?.role || 'user'),
                        timestamp: String(metadata?.timestamp || ''),
                        relevanceScore,
                        metadata: metadata || undefined
                    });
                }
            }
            return processedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        }
        catch (error) {
            console.error(`❌ Error searching smart memory: ${error}`);
            return [];
        }
    }
    async addToRecentCache(sessionId, message) {
        const key = `smart_memory:recent:${sessionId}`;
        const messageStr = JSON.stringify(message);
        await redis_1.redis.lpush(key, messageStr);
        await redis_1.redis.ltrim(key, 0, this.RECENT_MESSAGE_LIMIT - 1);
        await redis_1.redis.expire(key, 86400);
    }
    async getRecentMessages(sessionId) {
        const key = `smart_memory:recent:${sessionId}`;
        const items = await redis_1.redis.lrange(key, 0, -1);
        return items
            .map(item => {
            try {
                return JSON.parse(item);
            }
            catch {
                return null;
            }
        })
            .filter((item) => item !== null)
            .reverse();
    }
    shouldEmbed(message) {
        if (message.role === 'system')
            return false;
        if (message.content.length < 20)
            return false;
        if (message.role === 'user') {
            return message.content.includes('?') || message.content.length > 50;
        }
        if (message.role === 'assistant') {
            return message.content.length > 100;
        }
        return false;
    }
    async embedMessage(sessionId, message) {
        try {
            const embedding = await embeddingService_1.embeddingService.embed(message.content);
            if (!embedding || embedding.length === 0)
                return;
            const contentHash = Buffer.from(message.content + message.timestamp).toString('base64');
            const collectionName = `smart_memory_${sessionId}`;
            const exists = await chromaService_1.chromaService.documentExists(collectionName, contentHash);
            if (exists)
                return;
            await chromaService_1.chromaService.addToCollection(collectionName, [message.content], [embedding], [{
                    role: message.role,
                    timestamp: message.timestamp,
                    sessionId,
                    ...message.metadata
                }], [contentHash]);
        }
        catch (error) {
            console.error(`❌ Error embedding message: ${error}`);
        }
    }
    async searchRelevantMessages(sessionId, query) {
        const searchResults = await this.searchMemory(sessionId, query, 3);
        return searchResults.map(result => ({
            role: result.role,
            content: result.content,
            timestamp: result.timestamp,
            metadata: {
                ...result.metadata,
                relevanceScore: result.relevanceScore,
                source: 'vector_search'
            }
        }));
    }
    mergeMessages(recentMessages, relevantMessages) {
        const seen = new Set();
        const merged = [];
        for (const msg of relevantMessages) {
            const key = `${msg.content.substring(0, 50)}_${msg.timestamp}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(msg);
            }
        }
        for (const msg of recentMessages) {
            const key = `${msg.content.substring(0, 50)}_${msg.timestamp}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(msg);
            }
        }
        const sorted = merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return this.trimToTokenLimit(sorted);
    }
    trimToTokenLimit(messages) {
        let totalTokens = 0;
        const result = [];
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const estimatedTokens = Math.ceil(msg.content.length / 4);
            if (totalTokens + estimatedTokens <= this.CONTEXT_TOKEN_LIMIT) {
                result.unshift(msg);
                totalTokens += estimatedTokens;
            }
            else {
                break;
            }
        }
        return result;
    }
    async clearSession(sessionId) {
        try {
            await redis_1.redis.del(`smart_memory:recent:${sessionId}`);
            await chromaService_1.chromaService.deleteCollection(`smart_memory_${sessionId}`);
            console.log(`🧹 Cleared smart memory for session ${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Error clearing session memory: ${error}`);
        }
    }
    async getMemoryStats(sessionId) {
        try {
            const recentCount = await redis_1.redis.llen(`smart_memory:recent:${sessionId}`);
            let embeddedCount = 0;
            try {
                const allMessages = await chromaService_1.chromaService.getAllFromCollection(`smart_memory_${sessionId}`);
                embeddedCount = Array.isArray(allMessages) ? allMessages.length : 0;
            }
            catch {
                embeddedCount = 0;
            }
            return {
                recentCount,
                embeddedCount,
                memoryType: 'smart_on_demand'
            };
        }
        catch (error) {
            console.error(`❌ Error getting memory stats: ${error}`);
            return { recentCount: 0, embeddedCount: 0, memoryType: 'error' };
        }
    }
}
exports.SmartMemoryService = SmartMemoryService;
exports.smartMemoryService = new SmartMemoryService();
//# sourceMappingURL=smartMemoryService.js.map