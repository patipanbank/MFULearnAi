import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { JwtAuthGuard } from '../../modules/auth/jwt.guard';
import { RolesGuard } from '../../modules/auth/roles.guard';
import { Roles } from '../../modules/auth/roles.decorator';

@Controller('admin/monitoring')
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
   * Get performance report
   */
  @Get('report')
  async getPerformanceReport() {
    const report = await this.performanceService.getPerformanceReport();
    return {
      message: 'Performance report generated successfully',
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
   * Get performance alerts
   */
  @Get('alerts')
  async getAlerts() {
    const alerts = this.performanceService.getPerformanceAlerts();
    return {
      message: 'Performance alerts retrieved successfully',
      data: {
        alerts,
        count: alerts.length,
        hasAlerts: alerts.length > 0
      }
    };
  }

  /**
   * Get monitoring dashboard data
   */
  @Get('dashboard')
  async getDashboard() {
    const [performance, requests, report, alerts] = await Promise.all([
      this.performanceService.getSystemPerformance(),
      this.performanceService.getRequestMetrics(),
      this.performanceService.getPerformanceReport(),
      this.performanceService.getPerformanceAlerts()
    ]);

    // Get recent metrics for charts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const cpuMetrics = this.performanceService.getMetrics('cpu_usage', oneHourAgo);
    const memoryMetrics = this.performanceService.getMetrics('memory_usage_percent', oneHourAgo);
    const responseTimeMetrics = this.performanceService.getMetrics('http_request_duration', oneHourAgo);

    return {
      message: 'Monitoring dashboard data retrieved successfully',
      data: {
        overview: {
          performance,
          requests,
          alerts: {
            items: alerts,
            count: alerts.length
          }
        },
        charts: {
          cpu: cpuMetrics.map(m => ({
            timestamp: m.timestamp,
            value: m.value
          })),
          memory: memoryMetrics.map(m => ({
            timestamp: m.timestamp,
            value: m.value
          })),
          responseTime: responseTimeMetrics.map(m => ({
            timestamp: m.timestamp,
            value: m.value
          }))
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