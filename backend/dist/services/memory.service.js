"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryService = void 0;
const common_1 = require("@nestjs/common");
const bedrock_service_1 = require("../infrastructure/bedrock/bedrock.service");
const chroma_service_1 = require("./chroma.service");
const common_2 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let MemoryService = MemoryService_1 = class MemoryService {
    constructor(bedrockService, chromaService, redis) {
        this.bedrockService = bedrockService;
        this.chromaService = chromaService;
        this.redis = redis;
        this.logger = new common_1.Logger(MemoryService_1.name);
        this.maxMessagesInMemory = 100;
        this.embeddingThreshold = 10;
        this.maxSearchResults = 10;
    }
    collectionName(sessionId) {
        return `chat_memory_${sessionId}`;
    }
    cacheKey(sessionId, key) {
        return `memory:${sessionId}:${key}`;
    }
    async addChatMemory(sessionId, messages) {
        if (!messages.length) {
            this.logger.debug(`No messages to add for session: ${sessionId}`);
            return;
        }
        const colName = this.collectionName(sessionId);
        try {
            const existingIds = await this.getExistingMessageIds(colName);
            const newMessages = messages.filter(msg => !existingIds.has(msg.id));
            if (newMessages.length === 0) {
                this.logger.debug(`All messages already exist in memory for session: ${sessionId}`);
                return;
            }
            this.logger.log(`📚 Adding ${newMessages.length} new messages to memory for session: ${sessionId}`);
            const batchSize = 5;
            for (let i = 0; i < newMessages.length; i += batchSize) {
                const batch = newMessages.slice(i, i + batchSize);
                await this.processBatch(colName, batch);
            }
            await this.updateMemoryStats(sessionId, newMessages.length);
            await this.cleanupOldMemories(colName);
            this.logger.log(`✅ Successfully added ${newMessages.length} messages to memory`);
        }
        catch (error) {
            this.logger.error(`Failed to add chat memory for session ${sessionId}:`, error);
            throw error;
        }
    }
    async getExistingMessageIds(collectionName) {
        try {
            const existing = await this.chromaService.getDocuments(collectionName, 1000);
            return new Set((existing === null || existing === void 0 ? void 0 : existing.ids) || []);
        }
        catch (error) {
            this.logger.warn(`Could not get existing message IDs: ${error}`);
            return new Set();
        }
    }
    async processBatch(collectionName, messages) {
        const texts = messages.map(msg => {
            const content = msg.content.slice(0, 2000);
            return `[${msg.role.toUpperCase()}] ${content}`;
        });
        const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
        const docs = messages.map((msg, idx) => ({
            id: msg.id,
            text: texts[idx],
            embedding: embeddings[idx],
            metadata: {
                role: msg.role,
                timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
                originalLength: msg.content.length,
                ...msg.metadata
            },
        }));
        const validDocs = docs.filter(doc => doc.embedding && doc.embedding.length > 0);
        if (validDocs.length !== docs.length) {
            this.logger.warn(`${docs.length - validDocs.length} messages failed to embed`);
        }
        if (validDocs.length > 0) {
            await this.chromaService.addDocuments(collectionName, validDocs);
        }
    }
    async searchChatMemory(sessionId, query, topK = 5, minSimilarity = 0.7) {
        var _a;
        const colName = this.collectionName(sessionId);
        try {
            const cacheKey = this.cacheKey(sessionId, `search:${query}:${topK}`);
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                this.logger.debug(`🎯 Cache hit for memory search: ${sessionId}`);
                return JSON.parse(cached);
            }
            const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                this.logger.warn(`Failed to create embedding for query: ${query}`);
                return null;
            }
            const searchResult = await this.chromaService.queryCollection(colName, queryEmbedding, Math.min(topK, this.maxSearchResults));
            if (!searchResult) {
                return null;
            }
            const filteredResult = this.filterBySimilarity(searchResult, minSimilarity);
            await this.redis.setex(cacheKey, 300, JSON.stringify(filteredResult));
            this.logger.debug(`🔍 Found ${((_a = filteredResult.documents[0]) === null || _a === void 0 ? void 0 : _a.length) || 0} relevant memories for query`);
            return filteredResult;
        }
        catch (error) {
            this.logger.error(`Memory search failed for session ${sessionId}:`, error);
            return null;
        }
    }
    filterBySimilarity(result, minSimilarity) {
        if (!result.distances || !result.distances[0]) {
            return result;
        }
        const distances = result.distances[0];
        const documents = result.documents[0] || [];
        const metadatas = result.metadatas[0] || [];
        const filtered = {
            documents: [[]],
            metadatas: [[]],
            distances: [[]]
        };
        for (let i = 0; i < distances.length; i++) {
            const similarity = 1 - distances[i];
            if (similarity >= minSimilarity) {
                filtered.documents[0].push(documents[i]);
                filtered.metadatas[0].push(metadatas[i]);
                filtered.distances[0].push(distances[i]);
            }
        }
        return filtered;
    }
    async getMemoryStats(sessionId) {
        const colName = this.collectionName(sessionId);
        try {
            const count = await this.chromaService.countDocuments(colName);
            const docs = await this.chromaService.getDocuments(colName, 10);
            let averageLength = 0;
            let lastEmbeddingTime;
            if ((docs === null || docs === void 0 ? void 0 : docs.metadatas) && docs.metadatas.length > 0) {
                const lengths = docs.metadatas
                    .filter(meta => meta && typeof meta.originalLength === 'number')
                    .map(meta => meta.originalLength)
                    .filter(length => length > 0);
                averageLength = lengths.length > 0
                    ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
                    : 0;
                const timestamps = docs.metadatas
                    .filter(meta => meta && meta.timestamp && typeof meta.timestamp === 'string')
                    .map(meta => meta.timestamp)
                    .sort()
                    .reverse();
                if (timestamps.length > 0) {
                    lastEmbeddingTime = new Date(timestamps[0]);
                }
            }
            return {
                sessionId,
                totalMessages: count,
                embeddedMessages: count,
                lastEmbeddingTime,
                memorySize: count * averageLength,
                averageMessageLength: averageLength
            };
        }
        catch (error) {
            this.logger.error(`Failed to get memory stats for session ${sessionId}:`, error);
            return {
                sessionId,
                totalMessages: 0,
                embeddedMessages: 0,
                memorySize: 0,
                averageMessageLength: 0
            };
        }
    }
    async clearChatMemory(sessionId) {
        const colName = this.collectionName(sessionId);
        try {
            await this.chromaService.deleteCollection(colName);
            const pattern = this.cacheKey(sessionId, '*');
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
            this.logger.log(`🧹 Cleared memory for session: ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Failed to clear memory for session ${sessionId}:`, error);
            throw error;
        }
    }
    async optimizeMemory(sessionId) {
        const colName = this.collectionName(sessionId);
        try {
            const count = await this.chromaService.countDocuments(colName);
            if (count <= this.maxMessagesInMemory) {
                this.logger.debug(`Memory already optimized for session: ${sessionId}`);
                return;
            }
            const docs = await this.chromaService.getDocuments(colName, count);
            if (!(docs === null || docs === void 0 ? void 0 : docs.ids) || !(docs === null || docs === void 0 ? void 0 : docs.metadatas)) {
                return;
            }
            const indexed = docs.ids.map((id, i) => {
                const metadata = docs.metadatas[i];
                const timestamp = metadata === null || metadata === void 0 ? void 0 : metadata.timestamp;
                return {
                    id,
                    timestamp: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
                    metadata
                };
            });
            indexed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const toKeep = indexed.slice(0, this.maxMessagesInMemory);
            const toDelete = indexed.slice(this.maxMessagesInMemory).map(item => item.id);
            if (toDelete.length > 0) {
                await this.chromaService.deleteDocuments(colName, toDelete);
                this.logger.log(`🗑️ Deleted ${toDelete.length} old messages from memory for session: ${sessionId}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to optimize memory for session ${sessionId}:`, error);
        }
    }
    async cleanupOldMemories(collectionName) {
        try {
            const count = await this.chromaService.countDocuments(collectionName);
            if (count > this.maxMessagesInMemory) {
                const sessionId = collectionName.replace('chat_memory_', '');
                await this.optimizeMemory(sessionId);
            }
        }
        catch (error) {
            this.logger.warn(`Failed to cleanup old memories: ${error}`);
        }
    }
    async updateMemoryStats(sessionId, newMessageCount) {
        try {
            const statsKey = this.cacheKey(sessionId, 'stats');
            const stats = {
                lastUpdate: new Date().toISOString(),
                messagesAdded: newMessageCount,
                totalSessions: await this.getTotalSessions()
            };
            await this.redis.setex(statsKey, 3600, JSON.stringify(stats));
        }
        catch (error) {
            this.logger.warn(`Failed to update memory stats: ${error}`);
        }
    }
    async getTotalSessions() {
        try {
            const keys = await this.redis.keys('memory:*:stats');
            return keys.length;
        }
        catch (error) {
            return 0;
        }
    }
    async getGlobalMemoryStats() {
        try {
            const sessions = await this.redis.keys('memory:*:stats');
            let totalMessages = 0;
            for (const sessionKey of sessions) {
                try {
                    const sessionId = sessionKey.split(':')[1];
                    const stats = await this.getMemoryStats(sessionId);
                    totalMessages += stats.totalMessages;
                }
                catch (error) {
                }
            }
            return {
                totalSessions: sessions.length,
                totalMessages,
                averageMessagesPerSession: sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0
            };
        }
        catch (error) {
            this.logger.error(`Failed to get global memory stats:`, error);
            return {
                totalSessions: 0,
                totalMessages: 0,
                averageMessagesPerSession: 0
            };
        }
    }
    shouldEmbedSession(messageCount) {
        return messageCount > 0 && messageCount % this.embeddingThreshold === 0;
    }
    async preloadMemory(sessionId) {
        try {
            await this.searchChatMemory(sessionId, 'context', 1);
            this.logger.debug(`🔥 Preloaded memory for session: ${sessionId}`);
        }
        catch (error) {
            this.logger.warn(`Failed to preload memory: ${error}`);
        }
    }
};
exports.MemoryService = MemoryService;
exports.MemoryService = MemoryService = MemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService,
        chroma_service_1.ChromaService,
        ioredis_1.Redis])
], MemoryService);
//# sourceMappingURL=memory.service.js.map