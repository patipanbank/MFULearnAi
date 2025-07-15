import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { TrainingHistoryService } from './training-history.service';
import { CollectionModule } from '../collection/collection.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [CollectionModule, DatabaseModule],
  controllers: [TrainingController],
  providers: [TrainingService, TrainingHistoryService],
  exports: [TrainingService, TrainingHistoryService],
})
export class TrainingModule {} 