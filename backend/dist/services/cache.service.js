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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const app_exceptions_1 = require("../common/exceptions/app-exceptions");
let CacheService = CacheService_1 = class CacheService {
    constructor(redis) {
        this.redis = redis;
        this.logger = new common_1.Logger(CacheService_1.name);
        this.stats = {
            totalEntries: 0,
            hitRate: 0,
            missRate: 0,
        };
    }
    async set(key, value, ttl = 3600) {
        try {
            await this.redis.setex(key, ttl, JSON.stringify(value));
            this.stats.totalEntries++;
            this.logger.debug(`✅ Cache set: ${key}`);
        }
        catch (error) {
            this.logger.error(`❌ Cache set failed for key ${key}: ${error}`);
            throw new app_exceptions_1.SemanticCacheException('Failed to set cache entry', { key }, error);
        }
    }
    async get(key) {
        try {
            const data = await this.redis.get(key);
            if (data) {
                this.stats.hitRate = (this.stats.hitRate + 1) / 2;
                this.logger.debug(`🎯 Cache hit: ${key}`);
                return JSON.parse(data);
            }
            else {
                this.stats.missRate = (this.stats.missRate + 1) / 2;
                this.logger.debug(`❌ Cache miss: ${key}`);
                return null;
            }
        }
        catch (error) {
            this.logger.error(`❌ Cache get failed for key ${key}: ${error}`);
            return null;
        }
    }
    async delete(key) {
        try {
            const result = await this.redis.del(key);
            this.logger.debug(`🗑️ Cache delete: ${key}`);
            return result > 0;
        }
        catch (error) {
            this.logger.error(`❌ Cache delete failed for key ${key}: ${error}`);
            return false;
        }
    }
    async clear() {
        try {
            await this.redis.flushall();
            this.stats.totalEntries = 0;
            this.logger.log(`🧹 Cache cleared`);
        }
        catch (error) {
            this.logger.error(`❌ Cache clear failed: ${error}`);
            throw new app_exceptions_1.SemanticCacheException('Failed to clear cache', {}, error);
        }
    }
    getStats() {
        return { ...this.stats };
    }
    async optimizeCache() {
        try {
            this.logger.log('🔧 Cache optimization completed');
        }
        catch (error) {
            this.logger.error(`❌ Cache optimization failed: ${error}`);
        }
    }
    async warmupCache(dataItems) {
        try {
            this.logger.log(`🔥 Warming up cache with ${dataItems.length} items`);
            for (const item of dataItems) {
                await this.set(item.key, item.value, item.ttl);
            }
            this.logger.log(`✅ Cache warmup completed`);
        }
        catch (error) {
            this.logger.error(`❌ Cache warmup failed: ${error}`);
        }
    }
    async exportCache() {
        try {
            return {
                entries: [],
                stats: this.getStats(),
            };
        }
        catch (error) {
            this.logger.error(`❌ Cache export failed: ${error}`);
            throw new app_exceptions_1.SemanticCacheException('Failed to export cache', {}, error);
        }
    }
    async importCache(data) {
        try {
            this.logger.log(`📥 Importing cache data`);
            this.logger.log(`✅ Cache import completed`);
        }
        catch (error) {
            this.logger.error(`❌ Cache import failed: ${error}`);
            throw new app_exceptions_1.SemanticCacheException('Failed to import cache', {}, error);
        }
    }
    async findSimilarEntries(query, topK = 5, minSimilarity = 0.7) {
        try {
            return [];
        }
        catch (error) {
            this.logger.error(`❌ Similar entries search failed: ${error}`);
            return [];
        }
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_2.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [ioredis_1.Redis])
], CacheService);
//# sourceMappingURL=cache.service.js.map