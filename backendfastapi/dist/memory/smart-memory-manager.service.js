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
var SmartMemoryManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartMemoryManagerService = void 0;
const common_1 = require("@nestjs/common");
const vector_memory_service_1 = require("./vector-memory.service");
const langchain_redis_history_service_1 = require("./langchain-redis-history.service");
const messages_1 = require("@langchain/core/messages");
let SmartMemoryManagerService = SmartMemoryManagerService_1 = class SmartMemoryManagerService {
    vectorMemoryService;
    redisHistoryService;
    logger = new common_1.Logger(SmartMemoryManagerService_1.name);
    constructor(vectorMemoryService, redisHistoryService) {
        this.vectorMemoryService = vectorMemoryService;
        this.redisHistoryService = redisHistoryService;
    }
    async setupSmartMemoryManagement(sessionId, messages) {
        try {
            const messageCount = messages.length;
            this.logger.log(`🧠 Setting up smart memory management for ${sessionId} (${messageCount} messages)`);
            const redisMemoryExists = await this.redisHistoryService.checkRedisMemoryExists(sessionId);
            this.logger.log(`🔍 Redis memory check: ${redisMemoryExists ? 'exists' : 'empty'}`);
            if (!redisMemoryExists && messages.length > 0) {
                this.logger.log(`🔄 Redis memory empty, restoring recent context for session ${sessionId}`);
                const recentMessages = messages.length >= 10 ? messages.slice(-10) : messages;
                try {
                    const redisMessages = recentMessages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                    }));
                    await this.redisHistoryService.restoreMemory(sessionId, redisMessages);
                    this.logger.log(`💾 Restored ${recentMessages.length} messages to Redis memory`);
                }
                catch (error) {
                    this.logger.error(`❌ Failed to restore Redis memory: ${error}`);
                }
            }
            if (this.shouldEmbedMessages(messageCount)) {
                this.logger.log(`🔄 Embedding messages for session ${sessionId} (message count: ${messageCount})`);
                await this.vectorMemoryService.addMemory(sessionId, JSON.stringify(messages));
                this.logger.log(`📚 Embedded ${messages.length} messages to vector memory for session ${sessionId}`);
            }
            if (this.shouldUseMemoryTool(messageCount)) {
                this.logger.log(`🔍 Vector memory available for session ${sessionId} (${messageCount} messages)`);
            }
            else {
                this.logger.log(`💾 Using Redis memory only for session ${sessionId} (${messageCount} messages)`);
            }
        }
        catch (error) {
            this.logger.warn(`⚠️ Failed to setup smart memory management: ${error}`);
        }
    }
    getMemoryStrategy(messageCount) {
        if (messageCount > 50) {
            return 'vector';
        }
        else if (messageCount > 10) {
            return 'redis';
        }
        else {
            return 'basic';
        }
    }
    shouldUseMemoryTool(messageCount) {
        return messageCount > 50;
    }
    shouldUseRedisMemory(messageCount) {
        return messageCount > 10;
    }
    shouldEmbedMessages(messageCount) {
        return messageCount % 10 === 0 && messageCount > 0;
    }
    async getRelevantContext(sessionId, query, messageCount) {
        const strategy = this.getMemoryStrategy(messageCount);
        switch (strategy) {
            case 'vector':
                this.logger.log(`🔍 Using vector memory for context retrieval: ${sessionId}`);
                const docs = await this.vectorMemoryService.searchMemory(sessionId, query, 5);
                return docs.map(doc => ({
                    id: doc.metadata?.message_id || '',
                    role: doc.metadata?.role || 'assistant',
                    content: doc.pageContent,
                    timestamp: doc.metadata?.timestamp || new Date().toISOString(),
                }));
            case 'redis':
                this.logger.log(`💾 Using Redis memory for context retrieval: ${sessionId}`);
                const redisMessages = await this.redisHistoryService.getMessages(sessionId);
                return this.convertRedisMessages(redisMessages);
            case 'basic':
            default:
                this.logger.log(`📝 Using basic memory for context retrieval: ${sessionId}`);
                return [];
        }
    }
    convertRedisMessages(redisMessages) {
        return redisMessages.map((msg, index) => ({
            id: `redis_${index}`,
            role: msg._getType() === 'human' ? 'user' : 'assistant',
            content: msg.content,
            timestamp: new Date().toISOString(),
        }));
    }
    async clearAllMemory(sessionId) {
        try {
            await this.redisHistoryService.clearHistory(sessionId);
            await this.vectorMemoryService.clearMemory(sessionId);
            this.logger.log(`🧹 Cleared all memory for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to clear memory for session ${sessionId}: ${error}`);
        }
    }
    async getMemoryStats() {
        try {
            const [redisStats] = await Promise.all([
                this.redisHistoryService.getHistoryStats(),
            ]);
            const vectorStats = {
                totalSessions: 0,
                totalMessages: 0,
                sessions: {},
            };
            return {
                redis: redisStats,
                vector: vectorStats,
                totalSessions: new Set([
                    ...redisStats.activeSessions,
                    ...Object.keys(vectorStats.sessions)
                ]).size,
            };
        }
        catch (error) {
            this.logger.error(`❌ Failed to get memory stats: ${error}`);
            return {
                redis: { totalSessions: 0, activeSessions: [] },
                vector: { totalSessions: 0, totalMessages: 0, sessions: {} },
                totalSessions: 0,
            };
        }
    }
    async addMessage(sessionId, message, messageCount) {
        try {
            if (message.role === 'user') {
                await this.redisHistoryService.addMessage(sessionId, new messages_1.HumanMessage(message.content));
            }
            else if (message.role === 'assistant') {
                await this.redisHistoryService.addMessage(sessionId, new messages_1.AIMessage(message.content));
            }
            if (this.shouldEmbedMessages(messageCount)) {
                await this.vectorMemoryService.addMemory(sessionId, message.content);
            }
            this.logger.log(`💾 Added message to memory using ${this.getMemoryStrategy(messageCount)} strategy`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to add message to memory: ${error}`);
        }
    }
};
exports.SmartMemoryManagerService = SmartMemoryManagerService;
exports.SmartMemoryManagerService = SmartMemoryManagerService = SmartMemoryManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [vector_memory_service_1.VectorMemoryService,
        langchain_redis_history_service_1.LangChainRedisHistoryService])
], SmartMemoryManagerService);
//# sourceMappingURL=smart-memory-manager.service.js.map