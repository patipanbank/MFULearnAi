import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { TrainingHistory, TrainingHistorySchema } from '../models/training-history.model';
import { CollectionModule } from '../collection/collection.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { UploadModule } from '../upload/upload.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrainingHistory.name, schema: TrainingHistorySchema },
    ]),
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