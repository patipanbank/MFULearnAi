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
var CacheMiddleware_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachePresets = exports.CacheMiddleware = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let CacheMiddleware = CacheMiddleware_1 = class CacheMiddleware {
    constructor() {
        this.logger = new common_1.Logger(CacheMiddleware_1.name);
        this.defaultConfig = {
            ttl: 300,
            compress: true,
            varyBy: ['accept', 'accept-encoding']
        };
        this.redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
    }
    use(req, res, next) {
        this.applyCache(req, res, next, this.defaultConfig);
    }
    static create(config) {
        return (req, res, next) => {
            const middleware = new CacheMiddleware_1();
            const finalConfig = { ...middleware.defaultConfig, ...config };
            middleware.applyCache(req, res, next, finalConfig);
        };
    }
    async applyCache(req, res, next, config) {
        try {
            if (this.shouldSkipCache(req, config)) {
                return next();
            }
            const cacheKey = this.generateCacheKey(req, config);
            const cachedResponse = await this.getCachedResponse(cacheKey);
            if (cachedResponse) {
                this.logger.debug(`Cache HIT for key: ${cacheKey}`);
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Key', cacheKey);
                res.set('X-Cache-Age', String(Math.floor((Date.now() - cachedResponse.timestamp) / 1000)));
                Object.entries(cachedResponse.headers).forEach(([key, value]) => {
                    res.set(key, value);
                });
                return res.status(cachedResponse.statusCode).send(cachedResponse.body);
            }
            this.logger.debug(`Cache MISS for key: ${cacheKey}`);
            res.set('X-Cache', 'MISS');
            res.set('X-Cache-Key', cacheKey);
            const originalSend = res.send;
            const originalJson = res.json;
            const originalEnd = res.end;
            let responseBody;
            let responseSent = false;
            const self = this;
            res.send = function (body) {
                if (!responseSent) {
                    responseBody = body;
                    responseSent = true;
                    self.cacheResponse(cacheKey, res.statusCode, res.getHeaders(), body, config).catch(error => {
                        self.logger.error('Failed to cache response:', error);
                    });
                }
                return originalSend.call(this, body);
            };
            res.json = function (obj) {
                if (!responseSent) {
                    responseBody = obj;
                    responseSent = true;
                    self.cacheResponse(cacheKey, res.statusCode, res.getHeaders(), JSON.stringify(obj), config).catch(error => {
                        self.logger.error('Failed to cache response:', error);
                    });
                }
                return originalJson.call(this, obj);
            };
            res.end = function (chunk, encoding) {
                if (!responseSent && chunk) {
                    responseBody = chunk;
                    responseSent = true;
                    self.cacheResponse(cacheKey, res.statusCode, res.getHeaders(), chunk, config).catch(error => {
                        self.logger.error('Failed to cache response:', error);
                    });
                }
                return originalEnd.call(this, chunk, encoding);
            };
            next();
        }
        catch (error) {
            this.logger.error('Cache middleware error:', error);
            next();
        }
    }
    generateCacheKey(req, config) {
        if (config.keyGenerator) {
            return config.keyGenerator(req);
        }
        const parts = [`cache:${req.method}:${req.path}`];
        if (Object.keys(req.query).length > 0) {
            const sortedQuery = Object.keys(req.query)
                .sort()
                .map(key => `${key}=${req.query[key]}`)
                .join('&');
            parts.push(`query:${sortedQuery}`);
        }
        if (config.varyBy) {
            config.varyBy.forEach(header => {
                const headerValue = req.headers[header.toLowerCase()];
                if (headerValue) {
                    parts.push(`${header}:${headerValue}`);
                }
            });
        }
        const user = req.user;
        if (user) {
            parts.push(`user:${user.id}`);
        }
        return parts.join(':');
    }
    shouldSkipCache(req, config) {
        if (req.method !== 'GET') {
            return true;
        }
        if (config.skipIf && config.skipIf(req)) {
            return true;
        }
        const cacheControl = req.headers['cache-control'];
        if (cacheControl && cacheControl.includes('no-cache')) {
            return true;
        }
        if (process.env.NODE_ENV === 'development' && req.path.startsWith('/admin')) {
            return true;
        }
        return false;
    }
    async getCachedResponse(cacheKey) {
        try {
            const cached = await this.redis.get(cacheKey);
            if (!cached)
                return null;
            const response = JSON.parse(cached);
            const now = Date.now();
            const age = (now - response.timestamp) / 1000;
            if (age > 3600) {
                await this.redis.del(cacheKey);
                return null;
            }
            return response;
        }
        catch (error) {
            this.logger.error('Failed to get cached response:', error);
            return null;
        }
    }
    async cacheResponse(cacheKey, statusCode, headers, body, config) {
        try {
            if (statusCode < 200 || statusCode >= 300) {
                return;
            }
            const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
            if (bodyString.length > 1024 * 1024) {
                this.logger.warn(`Skipping cache for large response: ${bodyString.length} bytes`);
                return;
            }
            const cachedResponse = {
                statusCode,
                headers: this.filterHeaders(headers),
                body: bodyString,
                timestamp: Date.now(),
                tags: config.tags
            };
            await this.redis.setex(cacheKey, config.ttl, JSON.stringify(cachedResponse));
            if (config.tags) {
                await Promise.all(config.tags.map(tag => this.redis.sadd(`cache:tag:${tag}`, cacheKey)));
            }
            this.logger.debug(`Cached response for key: ${cacheKey} (TTL: ${config.ttl}s)`);
        }
        catch (error) {
            this.logger.error('Failed to cache response:', error);
        }
    }
    filterHeaders(headers) {
        const filtered = {};
        const allowedHeaders = [
            'content-type',
            'content-encoding',
            'content-language',
            'etag',
            'last-modified',
            'expires'
        ];
        Object.entries(headers).forEach(([key, value]) => {
            if (allowedHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
                filtered[key] = value;
            }
        });
        return filtered;
    }
    async invalidateCache(key) {
        try {
            await this.redis.del(key);
            this.logger.debug(`Invalidated cache key: ${key}`);
        }
        catch (error) {
            this.logger.error('Failed to invalidate cache:', error);
        }
    }
    async invalidateByTag(tag) {
        try {
            const keys = await this.redis.smembers(`cache:tag:${tag}`);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                await this.redis.del(`cache:tag:${tag}`);
                this.logger.debug(`Invalidated ${keys.length} cache entries with tag: ${tag}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to invalidate cache by tag:', error);
        }
    }
    async clearCache() {
        try {
            const keys = await this.redis.keys('cache:*');
            if (keys.length > 0) {
                await this.redis.del(...keys);
                this.logger.log(`Cleared ${keys.length} cache entries`);
            }
        }
        catch (error) {
            this.logger.error('Failed to clear cache:', error);
        }
    }
};
exports.CacheMiddleware = CacheMiddleware;
exports.CacheMiddleware = CacheMiddleware = CacheMiddleware_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CacheMiddleware);
class CachePresets {
    static shortTerm() {
        return CacheMiddleware.create({
            ttl: 60,
            tags: ['short-term']
        });
    }
    static mediumTerm() {
        return CacheMiddleware.create({
            ttl: 300,
            tags: ['medium-term']
        });
    }
    static longTerm() {
        return CacheMiddleware.create({
            ttl: 3600,
            tags: ['long-term']
        });
    }
    static static() {
        return CacheMiddleware.create({
            ttl: 86400,
            tags: ['static'],
            skipIf: (req) => { var _a; return ((_a = req.headers['cache-control']) === null || _a === void 0 ? void 0 : _a.includes('no-cache')) || false; }
        });
    }
    static userSpecific(ttl = 300) {
        return CacheMiddleware.create({
            ttl,
            keyGenerator: (req) => {
                const user = req.user;
                const userPart = user ? `user:${user.id}` : 'anonymous';
                return `cache:user:${userPart}:${req.method}:${req.path}`;
            },
            tags: ['user-specific']
        });
    }
    static collection(collectionId, ttl = 600) {
        return CacheMiddleware.create({
            ttl,
            keyGenerator: (req) => `cache:collection:${collectionId}:${req.method}:${req.path}`,
            tags: [`collection:${collectionId}`]
        });
    }
}
exports.CachePresets = CachePresets;
//# sourceMappingURL=cache.middleware.js.map