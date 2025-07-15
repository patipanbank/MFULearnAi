import { Module } from '@nestjs/common';
import { TaskQueueService } from './task-queue.service';
import { ChatModule } from '../chat/chat.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    ChatModule,
    RedisModule,
  ],
  controllers: [],
  providers: [TaskQueueService],
  exports: [TaskQueueService],
})
export class TaskModule {} 