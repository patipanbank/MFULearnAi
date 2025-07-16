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
var ChatMemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMemoryService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
let ChatMemoryService = ChatMemoryService_1 = class ChatMemoryService {
    redisService;
    logger = new common_1.Logger(ChatMemoryService_1.name);
    MESSAGE_STORE_PREFIX = 'message_store';
    TTL_SECONDS = 86400;
    constructor(redisService) {
        this.redisService = redisService;
    }
    getMessageKey(sessionId) {
        return `${this.MESSAGE_STORE_PREFIX}:${sessionId}`;
    }
    async addUserMessage(sessionId, content) {
        const message = {
            role: 'user',
            content,
            timestamp: new Date(),
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        await this.addMessage(sessionId, message);
        this.logger.debug(`Added user message to session ${sessionId}`);
    }
    async addAiMessage(sessionId, content) {
        const message = {
            role: 'assistant',
            content,
            timestamp: new Date(),
            id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        await this.addMessage(sessionId, message);
        this.logger.debug(`Added AI message to session ${sessionId}`);
    }
    async addSystemMessage(sessionId, content) {
        const message = {
            role: 'system',
            content,
            timestamp: new Date(),
            id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        await this.addMessage(sessionId, message);
        this.logger.debug(`Added system message to session ${sessionId}`);
    }
    async addMessage(sessionId, message) {
        const key = this.getMessageKey(sessionId);
        const redis = this.redisService.getRedisInstance();
        try {
            await redis.lpush(key, JSON.stringify(message));
            await redis.ltrim(key, 0, 9);
            await redis.expire(key, this.TTL_SECONDS);
            this.logger.debug(`Message added and trimmed for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Failed to add message to session ${sessionId}:`, error);
            throw error;
        }
    }
    async getMessages(sessionId) {
        const key = this.getMessageKey(sessionId);
        const redis = this.redisService.getRedisInstance();
        try {
            const messages = await redis.lrange(key, 0, -1);
            const parsedMessages = messages
                .map(msg => JSON.parse(msg))
                .reverse();
            this.logger.debug(`Retrieved ${parsedMessages.length} messages for session ${sessionId}`);
            return parsedMessages;
        }
        catch (error) {
            this.logger.error(`Failed to get messages for session ${sessionId}:`, error);
            return [];
        }
    }
    async clear(sessionId) {
        const key = this.getMessageKey(sessionId);
        const redis = this.redisService.getRedisInstance();
        try {
            await redis.del(key);
            this.logger.log(`🧹 Cleared Redis memory for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Failed to clear memory for session ${sessionId}:`, error);
            throw error;
        }
    }
    async hasMemory(sessionId) {
        const key = this.getMessageKey(sessionId);
        const redis = this.redisService.getRedisInstance();
        try {
            const exists = await redis.exists(key);
            return exists === 1;
        }
        catch (error) {
            this.logger.error(`Failed to check memory existence for session ${sessionId}:`, error);
            return false;
        }
    }
    async getMemoryStats() {
        const redis = this.redisService.getRedisInstance();
        try {
            const keys = await redis.keys(`${this.MESSAGE_STORE_PREFIX}:*`);
            let totalMessages = 0;
            for (const key of keys) {
                const messageCount = await redis.llen(key);
                totalMessages += messageCount;
            }
            return {
                totalSessions: keys.length,
                totalMessages,
            };
        }
        catch (error) {
            this.logger.error('Failed to get memory stats:', error);
            return { totalSessions: 0, totalMessages: 0 };
        }
    }
    async restoreFromHistory(sessionId, messages) {
        const recentMessages = messages.slice(-10);
        if (recentMessages.length === 0) {
            return;
        }
        const key = this.getMessageKey(sessionId);
        const redis = this.redisService.getRedisInstance();
        try {
            await redis.del(key);
            for (let i = recentMessages.length - 1; i >= 0; i--) {
                await redis.lpush(key, JSON.stringify(recentMessages[i]));
            }
            await redis.expire(key, this.TTL_SECONDS);
            this.logger.log(`💾 Restored ${recentMessages.length} messages to Redis memory for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Failed to restore memory for session ${sessionId}:`, error);
            throw error;
        }
    }
};
exports.ChatMemoryService = ChatMemoryService;
exports.ChatMemoryService = ChatMemoryService = ChatMemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], ChatMemoryService);
//# sourceMappingURL=chat-memory.service.js.map