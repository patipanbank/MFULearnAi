import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatMemoryService } from './chat-memory.service';
import { MemoryToolService } from './memory-tool.service';
import { ChatHistoryService } from './chat-history.service';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { VectorMemoryModule } from '../memory/vector-memory.module';
import { Chat, ChatSchema } from '../models/chat.model';

@Module({
  imports: [
    DatabaseModule, 
    RedisModule, 
    AuthModule,
    VectorMemoryModule,
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }])
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatMemoryService,
    MemoryToolService,
    ChatHistoryService,
  ],
  exports: [
    ChatService,
    ChatMemoryService,
    MemoryToolService,
    ChatHistoryService,
  ],
})
export class ChatModule {} 