"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationMemoryManager = void 0;
const redis_1 = require("../../lib/redis");
const chromaService_1 = require("../../services/chromaService");
const models_1 = require("../models");
class ConversationMemoryManager {
    constructor() {
        this.REDIS_KEY_PREFIX = 'conversation_memory:';
        this.CHROMA_COLLECTION = 'conversation_memory';
        this.SHORT_TERM_TTL = 24 * 60 * 60;
        console.log('🧠 ConversationMemoryManager initialized');
    }
    async loadMemory(conversationId, settings) {
        console.log(`🧠 Loading memory for conversation ${conversationId}`);
        const [shortTerm, longTerm] = await Promise.all([
            this.loadShortTermMemory(conversationId, settings),
            this.loadLongTermMemory(conversationId, settings)
        ]);
        const context = this.buildContext(shortTerm, longTerm, settings);
        return {
            shortTerm,
            longTerm: longTerm.map(embedding => ({
                pageContent: embedding.content,
                metadata: embedding.metadata
            })),
            context,
            embeddings: longTerm,
            lastUpdate: new Date()
        };
    }
    async loadShortTermMemory(conversationId, settings) {
        if (!settings.shortTermEnabled) {
            return [];
        }
        try {
            const redisKey = `${this.REDIS_KEY_PREFIX}${conversationId}`;
            const cachedMessages = await redis_1.redis.lrange(redisKey, 0, -1);
            if (cachedMessages.length > 0) {
                console.log(`🧠 Loaded ${cachedMessages.length} messages from Redis cache`);
                return cachedMessages.map(msg => JSON.parse(msg));
            }
            const messages = await models_1.ConversationMessageModel.findLatestByConversation?.(conversationId, settings.maxShortTermMessages) || [];
            if (messages.length > 0) {
                const messagesToCache = messages
                    .reverse()
                    .map(msg => JSON.stringify(msg));
                const pipeline = redis_1.redis.pipeline();
                pipeline.del(redisKey);
                for (const msg of messagesToCache) {
                    pipeline.rpush(redisKey, msg);
                }
                pipeline.expire(redisKey, this.SHORT_TERM_TTL);
                await pipeline.exec();
                console.log(`🧠 Cached ${messages.length} messages in Redis`);
            }
            return messages;
        }
        catch (error) {
            console.error('❌ Error loading short-term memory:', error);
            return [];
        }
    }
    async loadLongTermMemory(conversationId, settings) {
        if (!settings.longTermEnabled || !settings.embeddingEnabled) {
            return [];
        }
        try {
            const results = await chromaService_1.chromaService.searchSimilarDocuments?.(this.CHROMA_COLLECTION, '', 10, { conversationId }) || [];
            return results.map((result, index) => ({
                id: `embedding_${conversationId}_${index}`,
                content: result.pageContent,
                embedding: [],
                metadata: result.metadata,
                createdAt: new Date(result.metadata.timestamp || Date.now())
            }));
        }
        catch (error) {
            console.error('❌ Error loading long-term memory:', error);
            return [];
        }
    }
    buildContext(shortTerm, longTerm, settings) {
        const contextParts = [];
        if (longTerm.length > 0) {
            contextParts.push('Previous conversation context:');
            longTerm.slice(0, 3).forEach(memory => {
                contextParts.push(`- ${memory.content.substring(0, 200)}...`);
            });
            contextParts.push('');
        }
        if (shortTerm.length > 0) {
            contextParts.push('Recent conversation:');
            shortTerm.slice(-settings.contextWindow || -5).forEach(message => {
                const role = message.role === 'user' ? 'Human' : 'Assistant';
                contextParts.push(`${role}: ${message.content}`);
            });
        }
        return contextParts.join('\n');
    }
    async updateMemory(conversationId, messages, settings) {
        console.log(`🧠 Updating memory for conversation ${conversationId}`);
        const updatePromises = [];
        if (settings.shortTermEnabled) {
            updatePromises.push(this.updateShortTermMemory(conversationId, messages, settings));
        }
        if (settings.embeddingEnabled && this.shouldCreateEmbedding(messages.length, settings)) {
            updatePromises.push(this.updateLongTermMemory(conversationId, messages, settings));
        }
        await Promise.allSettled(updatePromises);
    }
    async updateShortTermMemory(conversationId, messages, settings) {
        try {
            const redisKey = `${this.REDIS_KEY_PREFIX}${conversationId}`;
            const pipeline = redis_1.redis.pipeline();
            const currentMessages = await redis_1.redis.lrange(redisKey, 0, -1);
            const currentCount = currentMessages.length;
            const newMessages = messages.slice(currentCount);
            for (const message of newMessages) {
                pipeline.rpush(redisKey, JSON.stringify(message));
            }
            const maxSize = settings.maxShortTermMessages || 10;
            pipeline.ltrim(redisKey, -maxSize, -1);
            pipeline.expire(redisKey, this.SHORT_TERM_TTL);
            await pipeline.exec();
            console.log(`🧠 Updated short-term memory: ${newMessages.length} new messages`);
        }
        catch (error) {
            console.error('❌ Error updating short-term memory:', error);
        }
    }
    async updateLongTermMemory(conversationId, messages, settings) {
        try {
            const summary = this.createConversationSummary(messages);
            if (summary.length < 50) {
                return;
            }
            await chromaService_1.chromaService.addDocuments?.(this.CHROMA_COLLECTION, [
                {
                    document: summary,
                    metadata: {
                        conversationId,
                        messageCount: messages.length,
                        timestamp: new Date().toISOString(),
                        type: 'conversation_summary'
                    },
                    embedding: [],
                    id: `summary_${conversationId}_${Date.now()}`
                }
            ]);
            console.log(`🧠 Created long-term memory embedding for ${messages.length} messages`);
        }
        catch (error) {
            console.error('❌ Error updating long-term memory:', error);
        }
    }
    createConversationSummary(messages) {
        const recentMessages = messages.slice(-10);
        const conversationText = recentMessages
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');
        return `Conversation summary:\n${conversationText}`;
    }
    shouldCreateEmbedding(messageCount, settings) {
        const threshold = settings.embeddingThreshold || 10;
        return messageCount > 0 && messageCount % threshold === 0;
    }
    async searchMemory(conversationId, query, limit = 5) {
        try {
            const results = await chromaService_1.chromaService.searchSimilarDocuments?.(this.CHROMA_COLLECTION, query, limit, { conversationId }) || [];
            return results.map((result, index) => ({
                id: `search_${conversationId}_${index}`,
                content: result.pageContent,
                embedding: [],
                metadata: result.metadata,
                createdAt: new Date(result.metadata.timestamp || Date.now())
            }));
        }
        catch (error) {
            console.error('❌ Error searching memory:', error);
            return [];
        }
    }
    async clearMemory(conversationId) {
        console.log(`🧹 Clearing memory for conversation ${conversationId}`);
        const clearPromises = [
            redis_1.redis.del(`${this.REDIS_KEY_PREFIX}${conversationId}`),
            this.clearLongTermMemory(conversationId)
        ];
        await Promise.allSettled(clearPromises);
    }
    async clearLongTermMemory(conversationId) {
        try {
            const results = await chromaService_1.chromaService.searchSimilarDocuments?.(this.CHROMA_COLLECTION, '', 1000, { conversationId }) || [];
            if (results.length > 0) {
                console.log(`🧹 Found ${results.length} long-term memories to clear`);
            }
        }
        catch (error) {
            console.error('❌ Error clearing long-term memory:', error);
        }
    }
    async getMemoryStats(conversationId) {
        try {
            const [shortTermCount, longTermResults] = await Promise.all([
                redis_1.redis.llen(`${this.REDIS_KEY_PREFIX}${conversationId}`),
                chromaService_1.chromaService.searchSimilarDocuments?.(this.CHROMA_COLLECTION, '', 1000, { conversationId }) || []
            ]);
            return {
                shortTermCount,
                longTermCount: longTermResults.length,
                totalSize: shortTermCount + longTermResults.length
            };
        }
        catch (error) {
            console.error('❌ Error getting memory stats:', error);
            return { shortTermCount: 0, longTermCount: 0, totalSize: 0 };
        }
    }
    cleanup() {
        console.log('🧹 ConversationMemoryManager cleaned up');
    }
}
exports.ConversationMemoryManager = ConversationMemoryManager;
//# sourceMappingURL=MemoryManager.js.map