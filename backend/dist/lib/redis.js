"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = connectRedis;
exports.getRedis = getRedis;
exports.disconnectRedis = disconnectRedis;
const ioredis_1 = __importDefault(require("ioredis"));
let redis = null;
async function connectRedis() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redis = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
            commandTimeout: 5000,
        });
        redis.on('connect', () => {
            console.log('✅ Connected to Redis');
        });
        redis.on('error', (error) => {
            console.error('❌ Redis connection error:', error);
        });
        redis.on('close', () => {
            console.log('🔌 Redis connection closed');
        });
        await redis.connect();
    }
    catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        throw error;
    }
}
function getRedis() {
    if (!redis) {
        throw new Error('Redis not connected. Call connectRedis() first.');
    }
    return redis;
}
async function disconnectRedis() {
    if (redis) {
        await redis.disconnect();
        redis = null;
    }
}
//# sourceMappingURL=redis.js.map