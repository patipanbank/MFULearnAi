import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisPubSubService } from './redis-pubsub.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [ConfigModule],
  providers: [RedisService, RedisPubSubService, ConfigService],
  exports: [RedisService, RedisPubSubService],
})
export class RedisModule {} 