import { Injectable, Logger } from '@nestjs/common';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface SystemPerformance {
  timestamp: Date;
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    free: number;
    usagePercent: number;
  };
  process: {
    uptime: number;
    pid: number;
    version: string;
    memoryUsage: NodeJS.MemoryUsage;
  };
  eventLoop: {
    delay: number;
  };
}

export interface RequestMetrics {
  totalRequests: number;
  activeConnections: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics
  
  // Request tracking
  private totalRequests = 0;
  private requestTimes: number[] = [];
  private errors = 0;
  private connections = 0;

  constructor() {
    // Start performance monitoring
    this.startMonitoring();
  }

  /**
   * Get current system performance
   */
  async getSystemPerformance(): Promise<SystemPerformance> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date(),
      cpu: {
        usage: cpuUsage.user / 1000000, // Convert to seconds
        load: this.getLoadAverage()
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        free: memoryUsage.heapTotal - memoryUsage.heapUsed,
        usagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version,
        memoryUsage
      },
      eventLoop: {
        delay: await this.measureEventLoopDelay()
      }
    };
  }

  /**
   * Get request metrics
   */
  getRequestMetrics(): RequestMetrics {
    const now = Date.now();
    const recentRequests = this.requestTimes.filter(time => now - time < 60000); // Last minute
    
    const averageResponseTime = this.requestTimes.length > 0 
      ? this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length 
      : 0;

    const requestsPerSecond = recentRequests.length / 60; // Requests per second in last minute
    const errorRate = this.totalRequests > 0 ? (this.errors / this.totalRequests) * 100 : 0;

    return {
      totalRequests: this.totalRequests,
      activeConnections: this.connections,
      averageResponseTime,
      requestsPerSecond,
      errorRate
    };
  }

  /**
   * Record a request
   */
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.totalRequests++;
    this.requestTimes.push(responseTime);
    
    if (isError) {
      this.errors++;
    }

    // Keep only recent request times (last 1000)
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }

    // Record metric
    this.addMetric('http_request_duration', responseTime, 'ms', {
      status: isError ? 'error' : 'success'
    });
  }

  /**
   * Record connection count
   */
  setConnectionCount(count: number): void {
    this.connections = count;
    this.addMetric('active_connections', count, 'count');
  }

  /**
   * Add a custom metric
   */
  addMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.logger.debug(`📊 Metric recorded: ${name} = ${value} ${unit}`);
  }

  /**
   * Get metrics by name
   */
  getMetrics(name?: string, since?: Date): PerformanceMetric[] {
    let filteredMetrics = this.metrics;

    if (name) {
      filteredMetrics = filteredMetrics.filter(metric => metric.name === name);
    }

    if (since) {
      filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= since);
    }

    return filteredMetrics;
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(name: string, since?: Date): {
    count: number;
    average: number;
    min: number;
    max: number;
    latest: number;
  } {
    const metrics = this.getMetrics(name, since);
    
    if (metrics.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        latest: 0
      };
    }

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      average: sum / metrics.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1]
    };
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts(): string[] {
    const alerts: string[] = [];
    const performance = this.getSystemPerformance();

    performance.then(perf => {
      // Memory alerts
      if (perf.memory.usagePercent > 90) {
        alerts.push(`Critical memory usage: ${perf.memory.usagePercent.toFixed(1)}%`);
      } else if (perf.memory.usagePercent > 80) {
        alerts.push(`High memory usage: ${perf.memory.usagePercent.toFixed(1)}%`);
      }

      // Event loop delay alerts
      if (perf.eventLoop.delay > 100) {
        alerts.push(`High event loop delay: ${perf.eventLoop.delay}ms`);
      }
    });

    // Request metrics alerts
    const requestMetrics = this.getRequestMetrics();
    
    if (requestMetrics.errorRate > 10) {
      alerts.push(`High error rate: ${requestMetrics.errorRate.toFixed(1)}%`);
    }

    if (requestMetrics.averageResponseTime > 1000) {
      alerts.push(`Slow response time: ${requestMetrics.averageResponseTime.toFixed(0)}ms`);
    }

    return alerts;
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThan: Date): number {
    const originalLength = this.metrics.length;
    this.metrics = this.metrics.filter(metric => metric.timestamp >= olderThan);
    const removed = originalLength - this.metrics.length;
    
    this.logger.log(`🧹 Cleared ${removed} old metrics`);
    return removed;
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(): Promise<{
    system: SystemPerformance;
    requests: RequestMetrics;
    alerts: string[];
    topMetrics: PerformanceMetric[];
  }> {
    const system = await this.getSystemPerformance();
    const requests = this.getRequestMetrics();
    const alerts = this.getPerformanceAlerts();
    
    // Get top metrics from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const topMetrics = this.getMetrics(undefined, oneHourAgo)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return {
      system,
      requests,
      alerts,
      topMetrics
    };
  }

  // Private helper methods

  private startMonitoring(): void {
    // Record system metrics every 30 seconds
    setInterval(async () => {
      try {
        const performance = await this.getSystemPerformance();
        
        this.addMetric('cpu_usage', performance.cpu.usage, 'seconds');
        this.addMetric('memory_usage_percent', performance.memory.usagePercent, 'percent');
        this.addMetric('event_loop_delay', performance.eventLoop.delay, 'ms');
        this.addMetric('process_uptime', performance.process.uptime, 'seconds');

      } catch (error) {
        this.logger.error('Failed to record system metrics:', error);
      }
    }, 30000);

    // Clean old metrics every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      this.clearOldMetrics(oneHourAgo);
    }, 60 * 60 * 1000);

    this.logger.log('📊 Performance monitoring started');
  }

  private getLoadAverage(): number[] {
    // Mock load average for non-unix systems
    try {
      return process.platform === 'win32' ? [0.5, 0.5, 0.5] : [0, 0, 0];
    } catch {
      return [0, 0, 0];
    }
  }

  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = process.hrtime.bigint() - start;
        resolve(Number(delta) / 1000000); // Convert to milliseconds
      });
    });
  }
} 