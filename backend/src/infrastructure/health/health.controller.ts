import { Controller, Get, UseGuards } from '@nestjs/common';
import { SimpleHealthService } from './simple-health.service';
import { JwtAuthGuard } from '../../modules/auth/jwt.guard';
import { RolesGuard } from '../../modules/auth/roles.guard';
import { Roles } from '../../modules/auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: SimpleHealthService) {}

  @Get()
  async check() {
    return this.healthService.getSimpleHealth();
  }

  @Get('detailed')
  async detailed() {
    return this.healthService.getHealthStatus();
  }
}