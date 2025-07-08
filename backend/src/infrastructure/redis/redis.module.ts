import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        // Check if REDIS_URL is provided (for docker-compose or production)
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          return new Redis(redisUrl);
        }
        
        // Fall back to individual environment variables
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379');
        const password = process.env.REDIS_PASSWORD;
        const db = parseInt(process.env.REDIS_DB || '0');
        
        return new Redis({
          host,
          port,
          password,
          db,
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {} 