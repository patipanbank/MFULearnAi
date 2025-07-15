import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.redisHost,
      port: this.configService.redisPort,
      lazyConnect: true,
    });
  }

  async onModuleDestroy() {
    await this.redis.disconnect();
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async del(key: string): Promise<number> {
    return await this.redis.del(key);
  }

  async exists(key: string): Promise<number> {
    return await this.redis.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  async flushall(): Promise<string> {
    return await this.redis.flushall();
  }

  // Health check
  async ping(): Promise<string> {
    return await this.redis.ping();
  }

  // Pub/Sub methods
  async publish(channel: string, message: string): Promise<number> {
    return await this.redis.publish(channel, message);
  }

  subscribe(channel: string, callback: (message: string) => void): void {
    const subscriber = new Redis({
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

  // Chat message streaming
  async publishChatMessage(sessionId: string, message: any): Promise<number> {
    return await this.publish(`chat:${sessionId}`, JSON.stringify(message));
  }

  // Queue methods (for task queue)
  async lpush(key: string, value: string): Promise<number> {
    return await this.redis.lpush(key, value);
  }

  async rpop(key: string): Promise<string | null> {
    return await this.redis.rpop(key);
  }

  async llen(key: string): Promise<number> {
    return await this.redis.llen(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redis.lrange(key, start, stop);
  }

  getRedisInstance(): Redis {
    return this.redis;
  }
} 