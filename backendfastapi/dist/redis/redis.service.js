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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const config_service_1 = require("../config/config.service");
let RedisService = class RedisService {
    configService;
    redis;
    constructor(configService) {
        this.configService = configService;
        this.redis = new ioredis_1.Redis({
            host: this.configService.redisHost,
            port: this.configService.redisPort,
            lazyConnect: true,
        });
    }
    async onModuleDestroy() {
        await this.redis.disconnect();
    }
    async set(key, value, ttl) {
        if (ttl) {
            await this.redis.setex(key, ttl, value);
        }
        else {
            await this.redis.set(key, value);
        }
    }
    async get(key) {
        return await this.redis.get(key);
    }
    async del(key) {
        return await this.redis.del(key);
    }
    async exists(key) {
        return await this.redis.exists(key);
    }
    async expire(key, seconds) {
        return await this.redis.expire(key, seconds);
    }
    async ttl(key) {
        return await this.redis.ttl(key);
    }
    async flushall() {
        return await this.redis.flushall();
    }
    async ping() {
        return await this.redis.ping();
    }
    async publish(channel, message) {
        return await this.redis.publish(channel, message);
    }
    subscribe(channel, callback) {
        const subscriber = new ioredis_1.Redis({
            host: this.configService.redisHost,
            port: this.configService.redisPort,
        });
        subscriber.subscribe(channel);
        subscriber.on('message', (receivedChannel, message) => {
            if (receivedChannel === channel) {
                callback(message);
            }
        });
    }
    async publishChatMessage(sessionId, message) {
        return await this.publish(`chat:${sessionId}`, JSON.stringify(message));
    }
    async lpush(key, value) {
        return await this.redis.lpush(key, value);
    }
    async rpop(key) {
        return await this.redis.rpop(key);
    }
    async llen(key) {
        return await this.redis.llen(key);
    }
    async lrange(key, start, stop) {
        return await this.redis.lrange(key, start, stop);
    }
    getRedisInstance() {
        return this.redis;
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map