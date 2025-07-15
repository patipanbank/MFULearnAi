import { Module } from '@nestjs/common';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingService } from './embedding.service';
import { BedrockModule } from '../bedrock/bedrock.module';
import { CollectionModule } from '../collection/collection.module';

@Module({
  imports: [BedrockModule, CollectionModule],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {} 