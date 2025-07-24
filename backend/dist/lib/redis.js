"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("../config/config"));
const redisUrl = process.env.REDIS_URL || config_1.default.REDIS_URL || 'redis://localhost:6379';
exports.redis = new ioredis_1.default(redisUrl);
exports.redis.on('connect', () => {
    console.log('✅ Connected to Redis:', redisUrl);
});
exports.redis.on('error', (err) => {
    console.error('❌ Redis error:', err);
});
//# sourceMappingURL=redis.js.map