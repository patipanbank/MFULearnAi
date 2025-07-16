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
var TaskQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskQueueService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const chat_service_1 = require("../chat/chat.service");
const chat_history_service_1 = require("../chat/chat-history.service");
const redis_pubsub_service_1 = require("../redis/redis-pubsub.service");
let TaskQueueService = TaskQueueService_1 = class TaskQueueService {
    redisService;
    chatService;
    chatHistoryService;
    redisPubSubService;
    logger = new common_1.Logger(TaskQueueService_1.name);
    constructor(redisService, chatService, chatHistoryService, redisPubSubService) {
        this.redisService = redisService;
        this.chatService = chatService;
        this.chatHistoryService = chatHistoryService;
        this.redisPubSubService = redisPubSubService;
    }
    async addChatTask(taskType, payload) {
        try {
            const taskData = {
                type: taskType,
                payload,
                timestamp: new Date().toISOString(),
                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };
            await this.redisService.lpush('chat_tasks', JSON.stringify(taskData));
            await this.processChatTask(taskData);
            this.logger.log(`✅ Chat task added and processed: ${taskType}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to add chat task: ${error.message}`);
            throw error;
        }
    }
    async processChatTask(taskData) {
        try {
            const { type, payload } = taskData;
            if (type === 'generate_response') {
                await this.generateResponse(payload);
            }
            else {
                this.logger.warn(`Unknown task type: ${type}`);
            }
        }
        catch (error) {
            this.logger.error(`❌ Failed to process chat task: ${error.message}`);
        }
    }
    async generateResponse(payload) {
        const { sessionId, userId, message, modelId, collectionNames, agentId, systemPrompt, temperature = 0.7, maxTokens = 4000, images = [], } = payload;
        try {
            this.logger.log(`🎯 Generating response for session ${sessionId}`);
            this.logger.log(`📝 Message: ${message}`);
            this.logger.log(`🤖 Agent ID: ${agentId || 'None'}`);
            this.logger.log(`🔧 Model ID: ${modelId}`);
            const assistantId = `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const buffer = [];
            const responseGenerator = this.chatService.generateResponse({
                sessionId,
                userId,
                message,
                modelId,
                collectionNames,
                agentId,
                systemPrompt,
                temperature,
                maxTokens,
                images,
            });
            for await (const chunk of responseGenerator) {
                try {
                    const data = JSON.parse(chunk);
                    if (data.type === 'chunk') {
                        const chunkPayload = data.data;
                        let chunkText = '';
                        if (Array.isArray(chunkPayload)) {
                            const textParts = [];
                            for (const part of chunkPayload) {
                                if (typeof part === 'string') {
                                    textParts.push(part);
                                }
                                else if (typeof part === 'object') {
                                    for (const key of ['text', 'content', 'value']) {
                                        if (part[key] && typeof part[key] === 'string') {
                                            textParts.push(part[key]);
                                            break;
                                        }
                                    }
                                }
                                else {
                                    textParts.push(String(part));
                                }
                            }
                            chunkText = textParts.join('');
                        }
                        else if (typeof chunkPayload === 'object') {
                            for (const key of ['text', 'content', 'value']) {
                                if (chunkPayload[key] && typeof chunkPayload[key] === 'string') {
                                    chunkText = chunkPayload[key];
                                    break;
                                }
                            }
                            if (!chunkText) {
                                chunkText = String(chunkPayload);
                            }
                        }
                        else {
                            chunkText = String(chunkPayload);
                        }
                        buffer.push(chunkText);
                        const message = JSON.stringify({ type: 'chunk', data: chunkText });
                        await this.redisPubSubService.publishChatMessage(sessionId, message);
                        this.logger.log(`📤 Published chunk to Redis: chat:${sessionId}`);
                    }
                    else if (['tool_start', 'tool_result', 'tool_error'].includes(data.type)) {
                        const message = JSON.stringify(data);
                        await this.redisPubSubService.publishChatMessage(sessionId, message);
                        this.logger.log(`🔧 Published ${data.type} to Redis: chat:${sessionId}`);
                    }
                    else if (data.type === 'end') {
                        const finalText = buffer.join('');
                        const assistantMessage = {
                            id: assistantId,
                            role: 'assistant',
                            content: finalText,
                            timestamp: new Date(),
                            isStreaming: false,
                            isComplete: true,
                        };
                        await this.chatHistoryService.addMessageToChat(sessionId, assistantMessage);
                        const message = JSON.stringify({ type: 'end' });
                        await this.redisPubSubService.publishChatMessage(sessionId, message);
                        this.logger.log(`🏁 Published end event to Redis: chat:${sessionId}`);
                    }
                }
                catch (parseError) {
                    this.logger.warn(`⚠️ Failed to parse chunk: ${parseError.message}`);
                    continue;
                }
            }
            this.logger.log(`✅ Response generation completed for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to generate response: ${error.message}`);
            const errorMessage = JSON.stringify({
                type: 'error',
                data: `Failed to generate response: ${error.message}`,
            });
            await this.redisPubSubService.publishChatMessage(sessionId, errorMessage);
        }
    }
    async getTaskStatus(taskId) {
        try {
            const status = await this.redisService.get(`task_status:${taskId}`);
            return status ? JSON.parse(status) : null;
        }
        catch (error) {
            this.logger.error(`❌ Failed to get task status: ${error.message}`);
            return null;
        }
    }
    async updateTaskStatus(taskId, status) {
        try {
            await this.redisService.set(`task_status:${taskId}`, JSON.stringify(status), 3600);
        }
        catch (error) {
            this.logger.error(`❌ Failed to update task status: ${error.message}`);
        }
    }
};
exports.TaskQueueService = TaskQueueService;
exports.TaskQueueService = TaskQueueService = TaskQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        chat_service_1.ChatService,
        chat_history_service_1.ChatHistoryService,
        redis_pubsub_service_1.RedisPubSubService])
], TaskQueueService);
//# sourceMappingURL=task-queue.service.js.map