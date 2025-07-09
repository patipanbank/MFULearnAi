import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PerformanceService } from './performance.service';

/**
 * Metrics controller for Prometheus (without authentication)
 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly performanceService: PerformanceService) {}

  /**
   * Metrics endpoint for Prometheus (no authentication required)
   */
  @Get()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Get metrics for Prometheus' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getPrometheusMetrics(): Promise<string> {
    try {
      const metrics = this.performanceService.getMetrics();
      
      // Format metrics for Prometheus
      const prometheusFormat = this.formatMetricsForPrometheus(metrics);
      
      return prometheusFormat;
    } catch (error) {
      // Return basic metrics if there's an error
      return this.getBasicMetrics();
    }
  }

  private formatMetricsForPrometheus(metrics: any[]): string {
    let output = '';
    
    // Add basic metrics
    output += `# HELP mfu_backend_requests_total Total number of requests\n`;
    output += `# TYPE mfu_backend_requests_total counter\n`;
    
    // Add memory usage
    const memoryUsage = process.memoryUsage();
    output += `# HELP mfu_backend_memory_usage_bytes Memory usage in bytes\n`;
    output += `# TYPE mfu_backend_memory_usage_bytes gauge\n`;
    output += `mfu_backend_memory_usage_bytes{type="rss"} ${memoryUsage.rss}\n`;
    output += `mfu_backend_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}\n`;
    output += `mfu_backend_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}\n`;
    output += `mfu_backend_memory_usage_bytes{type="external"} ${memoryUsage.external}\n`;
    
    // Add process uptime
    output += `# HELP mfu_backend_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE mfu_backend_uptime_seconds gauge\n`;
    output += `mfu_backend_uptime_seconds ${process.uptime()}\n`;
    
    // Add CPU usage if available
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      output += `# HELP mfu_backend_cpu_usage_microseconds CPU usage in microseconds\n`;
      output += `# TYPE mfu_backend_cpu_usage_microseconds counter\n`;
      output += `mfu_backend_cpu_usage_microseconds{type="user"} ${cpuUsage.user}\n`;
      output += `mfu_backend_cpu_usage_microseconds{type="system"} ${cpuUsage.system}\n`;
    }
    
    // Add specific metrics from performance service
    if (metrics && Array.isArray(metrics)) {
      for (const metric of metrics) {
        if (metric.name && typeof metric.value === 'number') {
          const metricName = metric.name.replace(/[^a-zA-Z0-9_]/g, '_');
          output += `# HELP mfu_backend_${metricName} ${metric.description || 'Custom metric'}\n`;
          output += `# TYPE mfu_backend_${metricName} gauge\n`;
          output += `mfu_backend_${metricName} ${metric.value}\n`;
        }
      }
    }
    
    return output;
  }

  private getBasicMetrics(): string {
    let output = '';
    
    // Add basic metrics when there's an error
    const memoryUsage = process.memoryUsage();
    output += `# HELP mfu_backend_memory_usage_bytes Memory usage in bytes\n`;
    output += `# TYPE mfu_backend_memory_usage_bytes gauge\n`;
    output += `mfu_backend_memory_usage_bytes{type="rss"} ${memoryUsage.rss}\n`;
    output += `mfu_backend_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}\n`;
    output += `mfu_backend_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}\n`;
    output += `mfu_backend_memory_usage_bytes{type="external"} ${memoryUsage.external}\n`;
    
    output += `# HELP mfu_backend_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE mfu_backend_uptime_seconds gauge\n`;
    output += `mfu_backend_uptime_seconds ${process.uptime()}\n`;
    
    return output;
  }
} 