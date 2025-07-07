import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SimpleHealthService } from './simple-health.service';

@Module({
  controllers: [HealthController],
  providers: [SimpleHealthService],
  exports: [SimpleHealthService],
})
export class HealthModule {} 