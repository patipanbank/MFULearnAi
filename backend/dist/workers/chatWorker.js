"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWorker = void 0;
const bullmq_1 = require("bullmq");
const config_1 = require("../config/config");
const queueService_1 = require("../services/queueService");
const connection = {
    host: new URL(config_1.config.redisUrl).hostname,
    port: parseInt(new URL(config_1.config.redisUrl).port),
    password: new URL(config_1.config.redisUrl).password || undefined,
};
exports.chatWorker = new bullmq_1.Worker('chat', async (job) => {
    console.log(`🎯 Processing chat job ${job.id}`);
    await queueService_1.queueService.processChatJob(job);
}, {
    connection,
    concurrency: 5,
});
exports.chatWorker.on('completed', (job) => {
    console.log(`✅ Chat job ${job.id} completed successfully`);
});
exports.chatWorker.on('failed', (job, err) => {
    console.error(`❌ Chat job ${job?.id} failed:`, err);
});
exports.chatWorker.on('error', (err) => {
    console.error('❌ Chat worker error:', err);
});
exports.chatWorker.on('ready', () => {
    console.log('🚀 Chat worker ready to process jobs');
});
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down chat worker gracefully...');
    await exports.chatWorker.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down chat worker gracefully...');
    await exports.chatWorker.close();
    process.exit(0);
});
console.log('🚀 Chat worker started');
//# sourceMappingURL=chatWorker.js.map