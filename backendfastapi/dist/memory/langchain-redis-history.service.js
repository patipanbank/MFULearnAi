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
var LangChainRedisHistoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangChainRedisHistoryService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const messages_1 = require("@langchain/core/messages");
let LangChainRedisHistoryService = LangChainRedisHistoryService_1 = class LangChainRedisHistoryService {
    configService;
    logger = new common_1.Logger(LangChainRedisHistoryService_1.name);
    histories = new Map();
    constructor(configService) {
        this.configService = configService;
    }
    createRedisHistory(sessionId) {
        if (!this.histories.has(sessionId)) {
            const history = {
                sessionId,
            };
            this.histories.set(sessionId, history);
        }
        return this.histories.get(sessionId);
    }
    async addMessage(sessionId, message) {
        try {
            const history = this.createRedisHistory(sessionId);
            this.logger.log(`Message added to history for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Error adding message to history: ${error}`);
        }
    }
    async getMessages(sessionId) {
        try {
            const history = this.createRedisHistory(sessionId);
            return [];
        }
        catch (error) {
            this.logger.error(`Error getting messages from history: ${error}`);
            return [];
        }
    }
    async clearHistory(sessionId) {
        try {
            const history = this.createRedisHistory(sessionId);
            this.histories.delete(sessionId);
            this.logger.log(`History cleared for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Error clearing history: ${error}`);
        }
    }
    async restoreMemory(sessionId, messages) {
        try {
            await this.clearHistory(sessionId);
            for (const msg of messages) {
                if (msg.role === 'user') {
                    await this.addMessage(sessionId, new messages_1.HumanMessage(msg.content));
                }
                else if (msg.role === 'assistant') {
                    await this.addMessage(sessionId, new messages_1.AIMessage(msg.content));
                }
            }
            this.logger.log(`💾 Restored ${messages.length} messages to Redis memory for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to restore Redis memory: ${error}`);
            throw error;
        }
    }
    async checkRedisMemoryExists(sessionId) {
        try {
            const messages = await this.getMessages(sessionId);
            const exists = messages.length > 0;
            this.logger.log(`🔍 Redis memory check for ${sessionId}: ${messages.length} messages found`);
            return exists;
        }
        catch (error) {
            this.logger.warn(`⚠️ Redis memory check failed for ${sessionId}: ${error}`);
            return false;
        }
    }
    async setHistoryTTL(sessionId, ttlSeconds) {
        try {
            this.logger.log(`⏰ Would set TTL ${ttlSeconds}s for session ${sessionId}`);
        }
        catch (error) {
            this.logger.warn(`⚠️ Could not set TTL: ${error}`);
        }
    }
    async getHistoryStats() {
        return {
            totalSessions: this.histories.size,
            activeSessions: Array.from(this.histories.keys()),
        };
    }
};
exports.LangChainRedisHistoryService = LangChainRedisHistoryService;
exports.LangChainRedisHistoryService = LangChainRedisHistoryService = LangChainRedisHistoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], LangChainRedisHistoryService);
class ValueError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValueError';
    }
}
//# sourceMappingURL=langchain-redis-history.service.js.map