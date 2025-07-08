import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentSchema } from './department.schema';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Department', schema: DepartmentSchema }])],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {} 