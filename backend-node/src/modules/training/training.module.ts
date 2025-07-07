import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { DocumentService } from '../../services/document.service';

@Module({
  imports: [],
  controllers: [TrainingController],
  providers: [TrainingService, DocumentService],
})
export class TrainingModule {} 