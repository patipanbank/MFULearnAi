import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { DatabaseModule } from '../database/database.module';
import { CollectionModule } from '../collection/collection.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { UploadModule } from '../upload/upload.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    DatabaseModule, // Import DatabaseModule to get access to all models
    CollectionModule,
    BedrockModule,
    UploadModule,
    ConfigModule,
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {} 