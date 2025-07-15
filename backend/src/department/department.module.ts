import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule, // Import DatabaseModule to get access to all models
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {} 