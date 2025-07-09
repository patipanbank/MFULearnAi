import { Controller, Get, UseGuards } from '@nestjs/common';
import { SimpleHealthService } from './simple-health.service';
import { JwtAuthGuard } from '../../modules/auth/jwt.guard';
import { RolesGuard } from '../../modules/auth/roles.guard';
import { Roles } from '../../modules/auth/roles.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: SimpleHealthService) {}

  @Get()
  async check() {
    return this.healthService.getSimpleHealth();
  }

  @Get('detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async detailed() {
    return this.healthService.getHealthStatus();
  }
}