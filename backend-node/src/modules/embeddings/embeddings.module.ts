import { Module } from '@nestjs/common';
import { BedrockModule } from '../../infrastructure/bedrock/bedrock.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { EmbeddingsController } from './embeddings.controller';
import { EmbeddingService } from '../../services/embedding.service';
import { VectorSearchService } from '../../services/vector-search.service';
import { CacheService } from '../../services/cache.service';
import { ChromaService } from '../../services/chroma.service';
import { DocumentService } from '../../services/document.service';
import { DocumentManagementService } from '../../services/document-management.service';
import { MemoryService } from '../../services/memory.service';

@Module({
  imports: [
    BedrockModule,
    RedisModule,
  ],
  controllers: [
    EmbeddingsController,
  ],
  providers: [
    ChromaService,
    DocumentService,
    DocumentManagementService,
    MemoryService,
    EmbeddingService,
    VectorSearchService,
    CacheService,
  ],
  exports: [
    EmbeddingService,
    VectorSearchService,
    CacheService,
    ChromaService,
    DocumentManagementService,
    MemoryService,
  ],
})
export class EmbeddingsModule {} 