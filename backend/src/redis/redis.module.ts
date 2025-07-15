import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisPubSubService } from './redis-pubsub.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [RedisService, RedisPubSubService],
  exports: [RedisService, RedisPubSubService],
})
export class RedisModule {} 