"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationWorker = void 0;
const bullmq_1 = require("bullmq");
const config_1 = require("../config/config");
const notificationHandler_1 = require("../queueHandlers/notificationHandler");
const connection = {
    host: new URL(config_1.config.redisUrl).hostname,
    port: parseInt(new URL(config_1.config.redisUrl).port),
    password: new URL(config_1.config.redisUrl).password || undefined,
};
exports.notificationWorker = new bullmq_1.Worker('notification', async (job) => {
    await (0, notificationHandler_1.handleNotificationJob)(job);
}, {
    connection,
    concurrency: 5,
});
exports.notificationWorker.on('completed', (job) => {
    console.log(`✅ Notification job ${job.id} completed successfully`);
});
exports.notificationWorker.on('failed', (job, err) => {
    console.error(`❌ Notification job ${job?.id} failed:`, err);
});
exports.notificationWorker.on('error', (err) => {
    console.error('❌ Notification worker error:', err);
});
exports.notificationWorker.on('ready', () => {
    console.log('🚀 Notification worker ready to process jobs');
});
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down notification worker gracefully...');
    await exports.notificationWorker.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down notification worker gracefully...');
    await exports.notificationWorker.close();
    process.exit(0);
});
console.log('🚀 Notification worker started');
//# sourceMappingURL=notificationWorker.js.map