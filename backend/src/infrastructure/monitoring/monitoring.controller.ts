import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/jwt.guard';
import { RolesGuard } from '../../modules/auth/roles.guard';
import { Roles } from '../../modules/auth/roles.decorator';
import { PerformanceService } from './performance.service';

@ApiTags('Monitoring')
@Controller({
  path: 'admin/monitoring',
  version: '1'
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'SuperAdmin')
export class MonitoringController {
  constructor(private readonly performanceService: PerformanceService) {}

  /**
   * Get system performance metrics
   */
  @Get('performance')
  async getPerformance() {
    const performance = await this.performanceService.getSystemPerformance();
    return {
      message: 'System performance retrieved successfully',
      data: performance
    };
  }

  /**
   * Get request metrics
   */
  @Get('requests')
  async getRequestMetrics() {
    const metrics = this.performanceService.getRequestMetrics();
    return {
      message: 'Request metrics retrieved successfully',
      data: metrics
    };
  }

  /**
   * Get detailed monitoring report
   */
  @Get('report')
  async getMonitoringReport() {
    const report = await this.performanceService.getPerformanceReport();
    return {
      message: 'Monitoring report retrieved successfully',
      data: report
    };
  }

  /**
   * Get specific metrics
   */
  @Get('metrics')
  async getMetrics(
    @Query('name') name?: string,
    @Query('since') since?: string
  ) {
    const sinceDate = since ? new Date(since) : undefined;
    const metrics = this.performanceService.getMetrics(name, sinceDate);
    
    return {
      message: 'Metrics retrieved successfully',
      data: {
        metrics,
        count: metrics.length
      }
    };
  }

  /**
   * Get metrics summary
   */
  @Get('metrics/summary')
  async getMetricsSummary(
    @Query('name') name: string,
    @Query('since') since?: string
  ) {
    if (!name) {
      return {
        message: 'Metric name is required',
        error: 'name parameter is required'
      };
    }

    const sinceDate = since ? new Date(since) : undefined;
    const summary = this.performanceService.getMetricsSummary(name, sinceDate);
    
    return {
      message: `Metrics summary for ${name} retrieved successfully`,
      data: summary
    };
  }

  /**
   * Get alerts
   */
  @Get('alerts')
  async getAlerts() {
    const alerts = this.performanceService.getPerformanceAlerts();
    return {
      message: 'Alerts retrieved successfully',
      data: alerts
    };
  }

  /**
   * Get monitoring dashboard data
   */
  @Get('dashboard')
  async getDashboard() {
    const [performance, requests, report] = await Promise.all([
      this.performanceService.getSystemPerformance(),
      this.performanceService.getRequestMetrics(),
      this.performanceService.getPerformanceReport()
    ]);

    return {
      message: 'Dashboard data retrieved successfully',
      data: {
        overview: {
          performance,
          requests,
          alerts: report.alerts
        },
        summary: {
          totalMetrics: report.topMetrics.length,
          systemUptime: performance.process.uptime,
          lastUpdated: new Date()
        }
      }
    };
  }
}

 