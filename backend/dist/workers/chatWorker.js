"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const config_1 = require("../config/config");
const chatHandler_1 = require("../queueHandlers/chatHandler");
const mongodb_1 = require("../lib/mongodb");
const connection = {
    host: new URL(config_1.config.redisUrl).hostname,
    port: parseInt(new URL(config_1.config.redisUrl).port),
    password: new URL(config_1.config.redisUrl).password || undefined,
};
(async () => {
    await (0, mongodb_1.connectDB)();
    const chatWorker = new bullmq_1.Worker('chat', async (job) => {
        await (0, chatHandler_1.handleChatJob)(job);
    }, {
        connection,
        concurrency: 5,
    });
    chatWorker.on('completed', (job) => {
        console.log(`✅ Chat job ${job.id} completed successfully`);
    });
    chatWorker.on('failed', (job, err) => {
        console.error(`❌ Chat job ${job?.id} failed:`, err);
    });
    chatWorker.on('error', (err) => {
        console.error('❌ Chat worker error:', err);
    });
    chatWorker.on('ready', () => {
        console.log('🚀 Chat worker ready to process jobs');
    });
    process.on('SIGTERM', async () => {
        console.log('🛑 Received SIGTERM, shutting down chat worker gracefully...');
        await chatWorker.close();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        console.log('🛑 Received SIGINT, shutting down chat worker gracefully...');
        await chatWorker.close();
        process.exit(0);
    });
    console.log('🚀 Chat worker started');
})();
//# sourceMappingURL=chatWorker.js.map