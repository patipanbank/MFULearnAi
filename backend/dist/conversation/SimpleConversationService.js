"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpleConversationService = exports.SimpleConversationService = void 0;
const uuid_1 = require("uuid");
const llmFactory_1 = require("../agent/llmFactory");
const redis_1 = require("../lib/redis");
const models_1 = require("./models");
class SimpleConversationService {
    constructor() {
        this.MEMORY_KEY_PREFIX = 'simple_conv:';
        this.MEMORY_TTL = 24 * 60 * 60;
        this.MAX_HISTORY = 10;
        console.log('🤖 SimpleConversationService initialized');
    }
    async processMessage(request, onChunk) {
        const startTime = Date.now();
        const messageId = (0, uuid_1.v4)();
        try {
            await this.saveMessage(request.conversationId, {
                id: (0, uuid_1.v4)(),
                conversationId: request.conversationId,
                role: 'user',
                content: request.message,
                status: 'completed',
                metadata: {
                    userId: request.userId,
                    agentId: request.config?.agentId,
                    modelId: request.config?.modelId
                },
                createdAt: new Date()
            });
            const history = await this.getConversationHistory(request.conversationId);
            const prompt = this.buildPrompt(request.message, history, request.config);
            const llm = (0, llmFactory_1.getLLM)(request.config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
                temperature: request.config?.temperature || 0.7,
                maxTokens: request.config?.maxTokens || 4000,
                systemPrompt: request.config?.systemPrompt || 'You are a helpful AI assistant.'
            });
            let fullResponse = '';
            const stream = llm.stream(prompt);
            for await (const chunk of stream) {
                if (chunk) {
                    fullResponse += chunk;
                    onChunk(chunk);
                }
            }
            const processingTime = Date.now() - startTime;
            await this.saveMessage(request.conversationId, {
                id: messageId,
                conversationId: request.conversationId,
                role: 'assistant',
                content: fullResponse,
                status: 'completed',
                metadata: {
                    userId: request.userId,
                    agentId: request.config?.agentId,
                    modelId: request.config?.modelId,
                    processingTime
                },
                createdAt: new Date()
            });
            const tokenUsage = {
                promptTokens: Math.ceil(prompt.length / 4),
                completionTokens: Math.ceil(fullResponse.length / 4),
                totalTokens: Math.ceil((prompt.length + fullResponse.length) / 4)
            };
            return {
                messageId,
                content: fullResponse,
                role: 'assistant',
                status: 'completed',
                tokenUsage,
                processingTime
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error('❌ Error processing message:', error);
            await this.saveMessage(request.conversationId, {
                id: messageId,
                conversationId: request.conversationId,
                role: 'assistant',
                content: 'I apologize, but I encountered an error while processing your request. Please try again.',
                status: 'failed',
                metadata: {
                    userId: request.userId,
                    agentId: request.config?.agentId,
                    modelId: request.config?.modelId,
                    processingTime,
                    errorDetails: {
                        code: 'PROCESSING_ERROR',
                        message: error instanceof Error ? error.message : 'Unknown error',
                        timestamp: new Date(),
                        retryable: true
                    }
                },
                createdAt: new Date()
            });
            return {
                messageId,
                content: 'I apologize, but I encountered an error while processing your request. Please try again.',
                role: 'assistant',
                status: 'failed',
                processingTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getConversationHistory(conversationId) {
        try {
            const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
            const cached = await redis_1.redis.lrange(cacheKey, 0, -1);
            if (cached.length > 0) {
                return cached.map(msg => JSON.parse(msg));
            }
            const messages = await models_1.ConversationMessageModel
                .find({ conversationId })
                .sort({ createdAt: 1 })
                .limit(this.MAX_HISTORY)
                .lean();
            if (messages.length > 0) {
                const pipeline = redis_1.redis.pipeline();
                pipeline.del(cacheKey);
                for (const msg of messages) {
                    pipeline.rpush(cacheKey, JSON.stringify(msg));
                }
                pipeline.expire(cacheKey, this.MEMORY_TTL);
                await pipeline.exec();
            }
            return messages;
        }
        catch (error) {
            console.error('❌ Error loading conversation history:', error);
            return [];
        }
    }
    async saveMessage(conversationId, message) {
        try {
            const messageDoc = new models_1.ConversationMessageModel({
                ...message,
                conversationId,
                role: message.role,
                content: message.content,
                status: message.status,
                metadata: {
                    ...message.metadata,
                    retryCount: 0
                },
                attachments: [],
                toolCalls: [],
                createdAt: message.createdAt || new Date(),
                updatedAt: new Date()
            });
            await messageDoc.save();
            const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
            await redis_1.redis.rpush(cacheKey, JSON.stringify(message));
            await redis_1.redis.ltrim(cacheKey, -this.MAX_HISTORY, -1);
            await redis_1.redis.expire(cacheKey, this.MEMORY_TTL);
        }
        catch (error) {
            console.error('❌ Error saving message:', error);
        }
    }
    buildPrompt(userMessage, history, config) {
        const systemPrompt = config?.systemPrompt || 'You are a helpful AI assistant.';
        let prompt = `${systemPrompt}\n\n`;
        if (history.length > 0) {
            prompt += 'Previous conversation:\n';
            history.slice(-6).forEach(msg => {
                const role = msg.role === 'user' ? 'Human' : 'Assistant';
                prompt += `${role}: ${msg.content}\n`;
            });
            prompt += '\n';
        }
        prompt += `Human: ${userMessage}\n\nAssistant:`;
        return prompt;
    }
    async clearConversation(conversationId) {
        try {
            const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
            await redis_1.redis.del(cacheKey);
            console.log(`🧹 Cleared conversation memory: ${conversationId}`);
        }
        catch (error) {
            console.error('❌ Error clearing conversation:', error);
        }
    }
    async getConversationStats(conversationId) {
        try {
            const messages = await models_1.ConversationMessageModel
                .find({ conversationId })
                .lean();
            const stats = {
                messageCount: messages.length,
                userMessages: messages.filter(m => m.role === 'user').length,
                assistantMessages: messages.filter(m => m.role === 'assistant').length,
                totalTokens: messages.reduce((sum, m) => sum + (m.metadata?.tokenUsage?.totalTokens || 0), 0),
                averageResponseTime: messages
                    .filter(m => m.role === 'assistant' && m.metadata?.processingTime)
                    .reduce((sum, m, _, arr) => sum + (m.metadata?.processingTime || 0) / arr.length, 0)
            };
            return stats;
        }
        catch (error) {
            console.error('❌ Error getting conversation stats:', error);
            return {
                messageCount: 0,
                userMessages: 0,
                assistantMessages: 0,
                totalTokens: 0,
                averageResponseTime: 0
            };
        }
    }
}
exports.SimpleConversationService = SimpleConversationService;
exports.simpleConversationService = new SimpleConversationService();
//# sourceMappingURL=SimpleConversationService.js.map