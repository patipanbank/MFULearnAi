import { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '../config/config.service';
export declare class RedisService implements OnModuleDestroy {
    private configService;
    private redis;
    constructor(configService: ConfigService);
    onModuleDestroy(): Promise<void>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    flushall(): Promise<string>;
    ping(): Promise<string>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string, callback: (message: string) => void): void;
    publishChatMessage(sessionId: string, message: any): Promise<number>;
    lpush(key: string, value: string): Promise<number>;
    rpop(key: string): Promise<string | null>;
    llen(key: string): Promise<number>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    getRedisInstance(): Redis;
}
