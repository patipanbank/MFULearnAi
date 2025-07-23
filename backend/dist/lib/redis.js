"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.redisClient = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("../config/config"));
const redisUrl = process.env.REDIS_URL || config_1.default.REDIS_URL || 'redis://localhost:6379';
exports.redis = new ioredis_1.default(redisUrl);
exports.redisClient = exports.redis;
exports.redis.on('connect', () => {
    console.log('✅ Connected to Redis:', redisUrl);
});
exports.redis.on('error', (err) => {
    console.error('❌ Redis error:', err);
});
const connectRedis = async () => {
    try {
        await exports.redis.ping();
        console.log('✅ Redis connection verified');
    }
    catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        throw error;
    }
};
exports.connectRedis = connectRedis;
//# sourceMappingURL=redis.js.map