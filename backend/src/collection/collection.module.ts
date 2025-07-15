import { Module } from '@nestjs/common';
import { ChromaService } from './chroma.service';
import { ConfigModule } from '../config/config.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    BedrockModule,
    DatabaseModule, // Import DatabaseModule to get access to all models
  ],
  controllers: [],
  providers: [ChromaService],
  exports: [ChromaService],
})
export class CollectionModule {} 