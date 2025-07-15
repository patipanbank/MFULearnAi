import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatsService, DailyStat, TotalStats, DailyChatStats } from './stats.service';
import { IsOptional, IsDateString } from 'class-validator';

class GetStatsQueryDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}

@Controller('stats')
@UseGuards(AuthGuard('jwt'))
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // Route 1: GET /stats - Get daily stats (Admin only)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getDailyStats(
    @Request() req,
    @Query() query: GetStatsQueryDto,
  ): Promise<DailyStat[]> {
    // Check if user is admin
    if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
      throw new ForbiddenException('Admin privileges required');
    }

    try {
      const stats = await this.statsService.getDailyStats(
        query.start_date,
        query.end_date,
      );
      return stats;
    } catch (error) {
      throw new BadRequestException('Failed to get daily stats');
    }
  }

  // Route 2: GET /stats/total - Get total stats (Admin only)
  @Get('total')
  @HttpCode(HttpStatus.OK)
  async getTotalStats(@Request() req): Promise<TotalStats> {
    // Check if user is admin
    if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
      throw new ForbiddenException('Admin privileges required');
    }

    try {
      const totalStats = await this.statsService.getTotalStats();
      return totalStats;
    } catch (error) {
      throw new BadRequestException('Failed to get total stats');
    }
  }

  // Route 3: GET /stats/daily - Get daily chat stats (Admin only)
  @Get('daily')
  @HttpCode(HttpStatus.OK)
  async getDailyChatStats(@Request() req): Promise<DailyChatStats> {
    // Check if user is admin
    if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
      throw new ForbiddenException('Admin privileges required');
    }

    try {
      const dailyStats = await this.statsService.getDailyChatStats();
      return dailyStats;
    } catch (error) {
      throw new BadRequestException('Failed to get daily chat stats');
    }
  }

  // Route 4: GET /stats/user - Get user stats (for current user)
  @Get('user')
  @HttpCode(HttpStatus.OK)
  async getUserStats(@Request() req): Promise<any> {
    try {
      const userStats = await this.statsService.getUserStats(req.user.id);
      return userStats;
    } catch (error) {
      throw new BadRequestException('Failed to get user stats');
    }
  }

  // Route 5: GET /stats/health - Get system health (Admin only)
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getSystemHealth(@Request() req): Promise<any> {
    // Check if user is admin
    if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
      throw new ForbiddenException('Admin privileges required');
    }

    try {
      const health = await this.statsService.getSystemHealth();
      return health;
    } catch (error) {
      throw new BadRequestException('Failed to get system health');
    }
  }
} 