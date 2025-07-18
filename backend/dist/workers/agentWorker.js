"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentWorker = void 0;
const bullmq_1 = require("bullmq");
const config_1 = require("../config/config");
const queueService_1 = require("../services/queueService");
const connection = {
    host: new URL(config_1.config.redisUrl).hostname,
    port: parseInt(new URL(config_1.config.redisUrl).port),
    password: new URL(config_1.config.redisUrl).password || undefined,
};
exports.agentWorker = new bullmq_1.Worker('agent', async (job) => {
    console.log(`🤖 Processing agent job ${job.id}`);
    await queueService_1.queueService.processAgentJob(job);
}, {
    connection,
    concurrency: 3,
});
exports.agentWorker.on('completed', (job) => {
    console.log(`✅ Agent job ${job.id} completed successfully`);
});
exports.agentWorker.on('failed', (job, err) => {
    console.error(`❌ Agent job ${job?.id} failed:`, err);
});
exports.agentWorker.on('error', (err) => {
    console.error('❌ Agent worker error:', err);
});
exports.agentWorker.on('ready', () => {
    console.log('🚀 Agent worker ready to process jobs');
});
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down agent worker gracefully...');
    await exports.agentWorker.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down agent worker gracefully...');
    await exports.agentWorker.close();
    process.exit(0);
});
console.log('🚀 Agent worker started');
//# sourceMappingURL=agentWorker.js.map