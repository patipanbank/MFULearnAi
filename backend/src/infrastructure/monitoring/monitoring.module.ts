import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MetricsController } from './metrics.controller';
import { PerformanceService } from './performance.service';

@Module({
  controllers: [MonitoringController, MetricsController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class MonitoringModule {} 