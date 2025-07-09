import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller({
  path: 'stats',
  version: '1'
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin')
  async getDailyStats(
    @Query('start_date') start?: string,
    @Query('end_date') end?: string,
  ) {
    return this.statsService.getDailyStats(start, end);
  }

  @Get('total')
  @Roles('SuperAdmin', 'Admin')
  async total() {
    return this.statsService.getTotalStats();
  }

  @Get('daily')
  @Roles('SuperAdmin', 'Admin')
  async dailyChats() {
    return this.statsService.getDailyChatStats();
  }
} 