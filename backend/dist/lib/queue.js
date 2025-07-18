"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueEvents = exports.Worker = exports.Queue = exports.notificationQueueEvents = exports.agentQueueEvents = exports.chatQueueEvents = exports.notificationQueue = exports.agentQueue = exports.chatQueue = void 0;
const bullmq_1 = require("bullmq");
Object.defineProperty(exports, "Queue", { enumerable: true, get: function () { return bullmq_1.Queue; } });
Object.defineProperty(exports, "Worker", { enumerable: true, get: function () { return bullmq_1.Worker; } });
Object.defineProperty(exports, "QueueEvents", { enumerable: true, get: function () { return bullmq_1.QueueEvents; } });
const config_1 = require("../config/config");
const connection = {
    host: new URL(config_1.config.redisUrl).hostname,
    port: parseInt(new URL(config_1.config.redisUrl).port),
    password: new URL(config_1.config.redisUrl).password || undefined,
};
const defaultJobOptions = {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000,
    },
};
exports.chatQueue = new bullmq_1.Queue('chat', { connection, defaultJobOptions });
exports.agentQueue = new bullmq_1.Queue('agent', { connection, defaultJobOptions });
exports.notificationQueue = new bullmq_1.Queue('notification', { connection, defaultJobOptions });
exports.chatQueueEvents = new bullmq_1.QueueEvents('chat', { connection });
exports.agentQueueEvents = new bullmq_1.QueueEvents('agent', { connection });
exports.notificationQueueEvents = new bullmq_1.QueueEvents('notification', { connection });
//# sourceMappingURL=queue.js.map