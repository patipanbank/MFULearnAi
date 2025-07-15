import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatHistoryService } from './chat-history.service';
import { ChatMemoryService } from './chat-memory.service';
import { MemoryToolService } from './memory-tool.service';
import { Chat, ChatSchema } from '../models/chat.model';
import { User, UserSchema } from '../models/user.model';
import { RedisModule } from '../redis/redis.module';
import { VectorMemoryModule } from '../memory/vector-memory.module';
import { LangChainModule } from '../langchain/langchain.module';
import { CollectionModule } from '../collection/collection.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: User.name, schema: UserSchema },
    ]),
    RedisModule,
    VectorMemoryModule,
    forwardRef(() => LangChainModule),
    CollectionModule,
    BedrockModule,
    ConfigModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatHistoryService,
    ChatMemoryService,
    MemoryToolService,
  ],
  exports: [
    ChatService,
    ChatHistoryService,
    ChatMemoryService,
    MemoryToolService,
  ],
})
export class ChatModule {} 