"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = exports.QueueService = void 0;
const queue_1 = require("../lib/queue");
const chatService_1 = require("./chatService");
const langchainChatService_1 = require("./langchainChatService");
const chat_1 = require("../models/chat");
class QueueService {
    async addChatJob(data) {
        const job = await queue_1.chatQueue.add('generate-answer', data, {
            jobId: `chat-${data.sessionId}-${Date.now()}`,
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        return job;
    }
    async addAgentJob(data) {
        const job = await queue_1.agentQueue.add('process-agent', data, {
            jobId: `agent-${data.agentId}-${Date.now()}`,
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        return job;
    }
    async processChatJob(job) {
        const { sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens, agentId } = job.data;
        console.log(`🎯 BullMQ task started for session ${sessionId}`);
        console.log(`📝 Message: ${message}`);
        console.log(`🤖 Agent ID: ${agentId || 'No agent'}`);
        console.log(`🔧 Model ID: ${modelId}`);
        try {
            const buffer = [];
            const assistantId = new Date().toISOString();
            const chat = await chat_1.ChatModel.findById(sessionId);
            if (!chat) {
                throw new Error(`Chat session ${sessionId} not found`);
            }
            const messages = [];
            if (systemPrompt) {
                messages.push({
                    role: 'assistant',
                    content: [{ text: systemPrompt }]
                });
            }
            const recentMessages = chat.messages.slice(-10);
            for (const msg of recentMessages) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: [{ text: msg.content }]
                });
            }
            messages.push({
                role: 'user',
                content: [{ text: message }]
            });
            const assistantMessage = await chatService_1.chatService.addMessage(sessionId, {
                role: 'assistant',
                content: '',
                images: [],
                isStreaming: true,
                isComplete: false
            });
            let fullResponse = '';
            const chatStream = langchainChatService_1.langchainChatService.chat(sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens);
            for await (const chunk of chatStream) {
                try {
                    const data = JSON.parse(chunk);
                    if (data.type === 'chunk') {
                        const chunkText = data.data;
                        buffer.push(chunkText);
                        fullResponse += chunkText;
                        await chat_1.ChatModel.updateOne({ _id: sessionId, 'messages.id': assistantMessage.id }, {
                            $set: {
                                'messages.$.content': fullResponse,
                                'messages.$.isStreaming': true
                            }
                        });
                        await this.publishToRedis(`chat:${sessionId}`, {
                            type: 'chunk',
                            data: chunkText,
                        });
                    }
                    else if (data.type === 'tool_start') {
                        await this.publishToRedis(`chat:${sessionId}`, data);
                    }
                    else if (data.type === 'tool_result') {
                        await this.publishToRedis(`chat:${sessionId}`, data);
                    }
                    else if (data.type === 'tool_error') {
                        await this.publishToRedis(`chat:${sessionId}`, data);
                    }
                    else if (data.type === 'end') {
                        await this.publishToRedis(`chat:${sessionId}`, data);
                    }
                }
                catch (error) {
                    console.error('Error parsing chunk:', error);
                    continue;
                }
            }
            await chat_1.ChatModel.updateOne({ _id: sessionId, 'messages.id': assistantMessage.id }, {
                $set: {
                    'messages.$.content': fullResponse,
                    'messages.$.isStreaming': false,
                    'messages.$.isComplete': true
                }
            });
            console.log(`✅ Chat job completed for session ${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Chat job failed for session ${sessionId}:`, error);
            throw error;
        }
    }
    async processAgentJob(job) {
        const { agentId, userId, data } = job.data;
        console.log(`🤖 Processing agent job for agent ${agentId}`);
        try {
            console.log(`✅ Agent job completed for agent ${agentId}`);
        }
        catch (error) {
            console.error(`❌ Agent job failed for agent ${agentId}:`, error);
            throw error;
        }
    }
    async publishToRedis(channel, message) {
        try {
            const redis = require('redis');
            const client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379/0' });
            await client.connect();
            await client.publish(channel, JSON.stringify(message));
            await client.disconnect();
            console.log(`📤 Published to Redis: ${channel}`);
        }
        catch (error) {
            console.error(`❌ Redis publish error: ${error}`);
        }
    }
    async getJobStatus(jobId) {
        const chatJob = await queue_1.chatQueue.getJob(jobId);
        const agentJob = await queue_1.agentQueue.getJob(jobId);
        const job = chatJob || agentJob;
        if (!job) {
            return null;
        }
        return {
            id: job.id,
            name: job.name,
            state: await job.getState(),
            progress: job.progress,
            data: job.data,
            failedReason: job.failedReason,
        };
    }
    async getQueueStats() {
        const chatStats = await queue_1.chatQueue.getJobCounts();
        const agentStats = await queue_1.agentQueue.getJobCounts();
        return {
            chat: chatStats,
            agent: agentStats,
        };
    }
}
exports.QueueService = QueueService;
exports.queueService = new QueueService();
//# sourceMappingURL=queueService.js.map