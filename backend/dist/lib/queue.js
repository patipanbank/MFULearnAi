"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = exports.Queue = exports.queueConfig = exports.agentQueue = exports.chatQueue = void 0;
const bullmq_1 = require("bullmq");
Object.defineProperty(exports, "Queue", { enumerable: true, get: function () { return bullmq_1.Queue; } });
Object.defineProperty(exports, "Worker", { enumerable: true, get: function () { return bullmq_1.Worker; } });
const config_1 = require("../config/config");
const connection = {
    host: new URL(config_1.config.redisUrl).hostname,
    port: parseInt(new URL(config_1.config.redisUrl).port),
    password: new URL(config_1.config.redisUrl).password || undefined,
};
exports.chatQueue = new bullmq_1.Queue('chat', { connection });
exports.agentQueue = new bullmq_1.Queue('agent', { connection });
exports.queueConfig = {
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
};
exports.chatQueue = new bullmq_1.Queue('chat', {
    connection,
    defaultJobOptions: exports.queueConfig.defaultJobOptions
});
exports.agentQueue = new bullmq_1.Queue('agent', {
    connection,
    defaultJobOptions: exports.queueConfig.defaultJobOptions
});
//# sourceMappingURL=queue.js.map