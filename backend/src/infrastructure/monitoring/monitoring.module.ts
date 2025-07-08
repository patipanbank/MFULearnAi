import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { PerformanceService } from './performance.service';

@Module({
  controllers: [MonitoringController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class MonitoringModule {} 