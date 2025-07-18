"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = exports.QueueService = void 0;
const queue_1 = require("../lib/queue");
const chatHandler_1 = require("../queueHandlers/chatHandler");
const agentHandler_1 = require("../queueHandlers/agentHandler");
const notificationHandler_1 = require("../queueHandlers/notificationHandler");
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
    async addNotificationJob(data) {
        const job = await queue_1.notificationQueue.add('send-notification', data, {
            jobId: `notification-${data.userId}-${Date.now()}`,
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        return job;
    }
    async processChatJob(job) {
        await (0, chatHandler_1.handleChatJob)(job);
    }
    async processAgentJob(job) {
        await (0, agentHandler_1.handleAgentJob)(job);
    }
    async processNotificationJob(job) {
        await (0, notificationHandler_1.handleNotificationJob)(job);
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