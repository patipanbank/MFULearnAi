import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        return new Redis(url);
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {} 