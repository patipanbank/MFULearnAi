import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule, // Import DatabaseModule to get access to all models
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {} 