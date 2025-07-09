"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RateLimitMiddleware_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitPresets = exports.RateLimitMiddleware = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let RateLimitMiddleware = RateLimitMiddleware_1 = class RateLimitMiddleware {
    constructor() {
        this.logger = new common_1.Logger(RateLimitMiddleware_1.name);
        this.defaultConfig = {
            windowMs: 15 * 60 * 1000,
            maxRequests: 100,
            statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please try again later.'
        };
        this.redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
    }
    use(req, res, next) {
        this.applyRateLimit(req, res, next, this.defaultConfig);
    }
    static create(config) {
        return (req, res, next) => {
            const middleware = new RateLimitMiddleware_1();
            const finalConfig = { ...middleware.defaultConfig, ...config };
            middleware.applyRateLimit(req, res, next, finalConfig);
        };
    }
    async applyRateLimit(req, res, next, config) {
        try {
            if (config.skipIf && config.skipIf(req)) {
                return next();
            }
            const key = this.generateKey(req, config);
            const window = Math.floor(Date.now() / config.windowMs);
            const redisKey = `rate_limit:${key}:${window}`;
            const current = await this.redis.incr(redisKey);
            if (current === 1) {
                await this.redis.expire(redisKey, Math.ceil(config.windowMs / 1000));
            }
            if (current > config.maxRequests) {
                this.logger.warn(`Rate limit exceeded for key: ${key} (${current}/${config.maxRequests})`);
                res.set({
                    'X-RateLimit-Limit': config.maxRequests.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': (Date.now() + config.windowMs).toString(),
                    'X-RateLimit-Window': config.windowMs.toString()
                });
                const rateLimitError = new common_1.HttpException({
                    statusCode: config.statusCode,
                    message: config.message,
                    error: 'Too Many Requests',
                    retryAfter: config.windowMs
                }, config.statusCode || common_1.HttpStatus.TOO_MANY_REQUESTS);
                return next(rateLimitError);
            }
            res.set({
                'X-RateLimit-Limit': config.maxRequests.toString(),
                'X-RateLimit-Remaining': Math.max(0, config.maxRequests - current).toString(),
                'X-RateLimit-Reset': (Date.now() + config.windowMs).toString(),
                'X-RateLimit-Window': config.windowMs.toString()
            });
            if (process.env.NODE_ENV === 'development') {
                this.logger.debug(`Rate limit info for ${key}: ${current}/${config.maxRequests}`);
            }
            next();
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                return next(error);
            }
            this.logger.error('Rate limit error:', error);
            next();
        }
    }
    generateKey(req, config) {
        if (config.keyGenerator) {
            return config.keyGenerator(req);
        }
        const user = req.user;
        if (user && user.id) {
            return `user:${user.id}`;
        }
        const ip = this.getClientIp(req);
        return `ip:${ip}`;
    }
    getClientIp(req) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0] : req.ip;
        return ip || 'unknown';
    }
};
exports.RateLimitMiddleware = RateLimitMiddleware;
exports.RateLimitMiddleware = RateLimitMiddleware = RateLimitMiddleware_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RateLimitMiddleware);
class RateLimitPresets {
    static auth() {
        return RateLimitMiddleware.create({
            windowMs: 15 * 60 * 1000,
            maxRequests: 5,
            keyGenerator: (req) => `auth:${req.ip}`,
            message: 'Too many authentication attempts. Please try again in 15 minutes.'
        });
    }
    static api() {
        return RateLimitMiddleware.create({
            windowMs: 60 * 1000,
            maxRequests: 60,
            message: 'API rate limit exceeded. Please slow down your requests.'
        });
    }
    static upload() {
        return RateLimitMiddleware.create({
            windowMs: 60 * 1000,
            maxRequests: 10,
            keyGenerator: (req) => {
                const user = req.user;
                return user ? `upload:user:${user.id}` : `upload:ip:${req.ip}`;
            },
            message: 'Upload rate limit exceeded. Please wait before uploading again.'
        });
    }
    static chat() {
        return RateLimitMiddleware.create({
            windowMs: 60 * 1000,
            maxRequests: 30,
            keyGenerator: (req) => {
                const user = req.user;
                return user ? `chat:user:${user.id}` : `chat:ip:${req.ip}`;
            },
            message: 'Chat rate limit exceeded. Please slow down your messages.'
        });
    }
    static admin() {
        return RateLimitMiddleware.create({
            windowMs: 60 * 1000,
            maxRequests: 200,
            keyGenerator: (req) => {
                const user = req.user;
                return user ? `admin:user:${user.id}` : `admin:ip:${req.ip}`;
            },
            skipIf: (req) => {
                const user = req.user;
                return user && user.role === 'SuperAdmin';
            },
            message: 'Admin API rate limit exceeded.'
        });
    }
    static strictAuth() {
        return RateLimitMiddleware.create({
            windowMs: 15 * 60 * 1000,
            maxRequests: 3,
            keyGenerator: (req) => `strict_auth:${req.ip}`,
            message: 'Too many authentication attempts. Please try again in 15 minutes.'
        });
    }
    static saml() {
        return RateLimitMiddleware.create({
            windowMs: 15 * 60 * 1000,
            maxRequests: 20,
            keyGenerator: (req) => `saml:${req.ip}`,
            message: 'Too many SAML authentication attempts. Please try again in 15 minutes.'
        });
    }
    static monitoring() {
        return RateLimitMiddleware.create({
            windowMs: 60 * 1000,
            maxRequests: 600,
            keyGenerator: (req) => `monitoring:${req.ip}`,
            message: 'Monitoring rate limit exceeded.'
        });
    }
    static health() {
        return RateLimitMiddleware.create({
            windowMs: 60 * 1000,
            maxRequests: 300,
            keyGenerator: (req) => `health:${req.ip}`,
            message: 'Health check rate limit exceeded.'
        });
    }
}
exports.RateLimitPresets = RateLimitPresets;
//# sourceMappingURL=rate-limit.middleware.js.map