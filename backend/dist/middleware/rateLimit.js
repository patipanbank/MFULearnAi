"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBypass = exports.createUserRateLimiter = exports.createRateLimiters = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const redis_1 = require("../lib/redis");
const createRateLimiters = () => {
    const generalLimiter = (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: (...args) => (0, redis_1.getRedis)().call(...args),
        }),
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: {
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    const authLimiter = (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: (...args) => (0, redis_1.getRedis)().call(...args),
        }),
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: {
            error: 'Too many authentication attempts, please try again later.',
            retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    const chatLimiter = (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: (...args) => (0, redis_1.getRedis)().call(...args),
        }),
        windowMs: 1 * 60 * 1000,
        max: 30,
        message: {
            error: 'Too many chat requests, please slow down.',
            retryAfter: '1 minute'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    const agentLimiter = (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: (...args) => (0, redis_1.getRedis)().call(...args),
        }),
        windowMs: 60 * 60 * 1000,
        max: 10,
        message: {
            error: 'Too many agent creation attempts, please try again later.',
            retryAfter: '1 hour'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    const uploadLimiter = (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: (...args) => (0, redis_1.getRedis)().call(...args),
        }),
        windowMs: 60 * 60 * 1000,
        max: 20,
        message: {
            error: 'Too many file uploads, please try again later.',
            retryAfter: '1 hour'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    const wsLimiter = (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: (...args) => (0, redis_1.getRedis)().call(...args),
        }),
        windowMs: 1 * 60 * 1000,
        max: 10,
        message: {
            error: 'Too many WebSocket connection attempts, please try again later.',
            retryAfter: '1 minute'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    return {
        general: generalLimiter,
        auth: authLimiter,
        chat: chatLimiter,
        agent: agentLimiter,
        upload: uploadLimiter,
        websocket: wsLimiter
    };
};
exports.createRateLimiters = createRateLimiters;
const createUserRateLimiter = (windowMs, max) => {
    return (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: (...args) => (0, redis_1.getRedis)().call(...args),
            prefix: 'user_rate_limit:',
        }),
        windowMs,
        max,
        keyGenerator: (req) => {
            return req.user?.id || req.ip;
        },
        message: {
            error: 'Rate limit exceeded for this user.',
            retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};
exports.createUserRateLimiter = createUserRateLimiter;
const adminBypass = (req, res, next) => {
    if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
        return next();
    }
    return next();
};
exports.adminBypass = adminBypass;
//# sourceMappingURL=rateLimit.js.map