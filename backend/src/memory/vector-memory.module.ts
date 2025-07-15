import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { VectorMemoryService } from './vector-memory.service';
import { LangChainRedisHistoryService } from './langchain-redis-history.service';
import { SmartMemoryManagerService } from './smart-memory-manager.service';

@Module({
  imports: [ConfigModule],
  providers: [
    VectorMemoryService,
    LangChainRedisHistoryService,
    SmartMemoryManagerService,
  ],
  exports: [
    VectorMemoryService,
    LangChainRedisHistoryService,
    SmartMemoryManagerService,
  ],
})
export class VectorMemoryModule {} 