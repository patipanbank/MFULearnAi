import { Module } from '@nestjs/common';
import { ChromaService } from './chroma.service';
import { ConfigModule } from '../config/config.module';
import { BedrockModule } from '../bedrock/bedrock.module';

@Module({
  imports: [
    ConfigModule,
    BedrockModule,
  ],
  controllers: [],
  providers: [ChromaService],
  exports: [ChromaService],
})
export class CollectionModule {} 