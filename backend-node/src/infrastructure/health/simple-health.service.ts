import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface SimpleHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  uptime: number;
  checks: SimpleHealthCheck[];
}

export interface SimpleHealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  duration: number;
  message: string;
}

@Injectable()
export class SimpleHealthService {
  private readonly logger = new Logger(SimpleHealthService.name);
  private readonly startTime = Date.now();

  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  /**
   * Get basic health status
   */
  async getHealthStatus(): Promise<SimpleHealthStatus> {
    const startTime = Date.now();
    this.logger.debug('🏥 Starting health check...');

    const checks: SimpleHealthCheck[] = [];

    // Check database
    checks.push(await this.checkDatabase());

    // Check memory
    checks.push(await this.checkMemory());

    // Check system
    checks.push(await this.checkSystem());

    // Determine overall status
    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warn');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const totalDuration = Date.now() - startTime;
    this.logger.log(`🏥 Health check completed in ${totalDuration}ms - Status: ${overallStatus}`);

    return {
      status: overallStatus,
      timestamp: new Date(),
      version: '1.0.0',
      uptime: Date.now() - this.startTime,
      checks
    };
  }

  /**
   * Get simple health for load balancer
   */
  async getSimpleHealth(): Promise<{ status: string; timestamp: Date }> {
    try {
      const isDbHealthy = this.mongoConnection.readyState === 1;
      
      return {
        status: isDbHealthy ? 'ok' : 'error',
        timestamp: new Date()
      };
    } catch {
      return {
        status: 'error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<SimpleHealthCheck> {
    const startTime = Date.now();
    
    try {
      const isConnected = this.mongoConnection.readyState === 1;
      
      if (!isConnected) {
        return {
          name: 'database',
          status: 'fail',
          duration: Date.now() - startTime,
          message: `Database not connected. State: ${this.mongoConnection.readyState}`
        };
      }

      const duration = Date.now() - startTime;
      const isHealthy = duration < 1000;

      return {
        name: 'database',
        status: isHealthy ? 'pass' : 'warn',
        duration,
        message: isHealthy ? 'Database connection healthy' : 'Database responding slowly'
      };

    } catch {
      return {
        name: 'database',
        status: 'fail',
        duration: Date.now() - startTime,
        message: 'Database check failed'
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<SimpleHealthCheck> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      let status: 'pass' | 'warn' | 'fail';
      let message: string;

      if (memoryUsagePercent > 90) {
        status = 'fail';
        message = `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`;
      } else if (memoryUsagePercent > 75) {
        status = 'warn';
        message = `High memory usage: ${memoryUsagePercent.toFixed(1)}%`;
      } else {
        status = 'pass';
        message = `Memory usage normal: ${memoryUsagePercent.toFixed(1)}%`;
      }

      return {
        name: 'memory',
        status,
        duration: Date.now() - startTime,
        message
      };

    } catch {
      return {
        name: 'memory',
        status: 'fail',
        duration: Date.now() - startTime,
        message: 'Memory check failed'
      };
    }
  }

  /**
   * Check system status
   */
  private async checkSystem(): Promise<SimpleHealthCheck> {
    const startTime = Date.now();
    
    try {
      const uptime = process.uptime();
      const uptimeHours = uptime / 3600;

      let status: 'pass' | 'warn' | 'fail';
      let message: string;

      if (uptimeHours < 0.1) { // Less than 6 minutes
        status = 'warn';
        message = `System recently started: ${uptimeHours.toFixed(1)} hours`;
      } else {
        status = 'pass';
        message = `System running: ${uptimeHours.toFixed(1)} hours`;
      }

      return {
        name: 'system',
        status,
        duration: Date.now() - startTime,
        message
      };

    } catch {
      return {
        name: 'system',
        status: 'fail',
        duration: Date.now() - startTime,
        message: 'System check failed'
      };
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<{
    memory: NodeJS.MemoryUsage;
    uptime: number;
    version: string;
    nodeVersion: string;
  }> {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      version: '1.0.0',
      nodeVersion: process.version
    };
  }
}