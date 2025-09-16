/**
 * Comprehensive Metrics Service
 * Collects and aggregates system performance metrics, business metrics, and health indicators
 */

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  // Request metrics
  requestCount: number;
  requestDuration: number[];
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };

  // Error metrics
  errorCount: number;
  errorRate: number;
  errorsByType: Map<string, number>;

  // WebSocket metrics
  activeConnections: number;
  messagesPerSecond: number;
  connectionLifetime: number[];

  // Database metrics
  dbQueryCount: number;
  dbQueryDuration: number[];
  dbConnectionPool: {
    active: number;
    idle: number;
    pending: number;
  };

  // Memory metrics
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };

  // CPU metrics
  cpuUsage: number;

  // Cache metrics
  cacheHitRate: number;
  cacheMissRate: number;
  cacheSize: number;
}

export interface BusinessMetrics {
  // User metrics
  activeUsers: number;
  newUsersToday: number;
  userSessions: number;

  // Chat metrics
  totalChats: number;
  newChatsToday: number;
  messagesPerChat: number;
  avgChatDuration: number;

  // Agent metrics
  agentUsage: Map<string, number>;
  toolUsage: Map<string, number>;

  // Document metrics
  documentsProcessed: number;
  embeddings: number;
  searchQueries: number;

  // System usage
  apiCallsPerHour: number;
  peakConcurrentUsers: number;
  storageUsed: number;
}

export interface HealthMetrics {
  uptime: number;
  lastHealthCheck: Date;
  servicesStatus: Map<string, 'healthy' | 'degraded' | 'down'>;
  dependencies: {
    mongodb: boolean;
    redis: boolean;
    chroma: boolean;
    minio: boolean;
    aws: boolean;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
    service: string;
  }>;
}

class MetricsService extends EventEmitter {
  private performanceMetrics: PerformanceMetrics;
  private businessMetrics: BusinessMetrics;
  private healthMetrics: HealthMetrics;
  private metricsInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Metric collection windows
  private requestTimes: number[] = [];
  private connectionLifetimes: number[] = [];
  private queryTimes: number[] = [];

  // Rate limiters
  private readonly MAX_SAMPLES = 1000;
  private readonly METRICS_INTERVAL = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  constructor() {
    super();
    this.initializeMetrics();
    this.startMetricsCollection();
    this.startHealthChecks();
  }

  private initializeMetrics(): void {
    this.performanceMetrics = {
      requestCount: 0,
      requestDuration: [],
      responseTime: { min: 0, max: 0, avg: 0, p95: 0, p99: 0 },
      errorCount: 0,
      errorRate: 0,
      errorsByType: new Map(),
      activeConnections: 0,
      messagesPerSecond: 0,
      connectionLifetime: [],
      dbQueryCount: 0,
      dbQueryDuration: [],
      dbConnectionPool: { active: 0, idle: 0, pending: 0 },
      memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
      cpuUsage: 0,
      cacheHitRate: 0,
      cacheMissRate: 0,
      cacheSize: 0,
    };

    this.businessMetrics = {
      activeUsers: 0,
      newUsersToday: 0,
      userSessions: 0,
      totalChats: 0,
      newChatsToday: 0,
      messagesPerChat: 0,
      avgChatDuration: 0,
      agentUsage: new Map(),
      toolUsage: new Map(),
      documentsProcessed: 0,
      embeddings: 0,
      searchQueries: 0,
      apiCallsPerHour: 0,
      peakConcurrentUsers: 0,
      storageUsed: 0,
    };

    this.healthMetrics = {
      uptime: 0,
      lastHealthCheck: new Date(),
      servicesStatus: new Map(),
      dependencies: {
        mongodb: false,
        redis: false,
        chroma: false,
        minio: false,
        aws: false,
      },
      alerts: [],
    };
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.calculateDerivedMetrics();
      this.emit('metrics:collected', {
        performance: this.performanceMetrics,
        business: this.businessMetrics,
        health: this.healthMetrics,
      });
    }, this.METRICS_INTERVAL);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private collectSystemMetrics(): void {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.performanceMetrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.performanceMetrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    // Uptime
    this.healthMetrics.uptime = process.uptime();
  }

  private calculateDerivedMetrics(): void {
    // Response time percentiles
    if (this.requestTimes.length > 0) {
      const sorted = [...this.requestTimes].sort((a, b) => a - b);
      const len = sorted.length;

      this.performanceMetrics.responseTime = {
        min: sorted[0],
        max: sorted[len - 1],
        avg: sorted.reduce((a, b) => a + b, 0) / len,
        p95: sorted[Math.floor(len * 0.95)],
        p99: sorted[Math.floor(len * 0.99)],
      };
    }

    // Error rate
    const totalRequests = this.performanceMetrics.requestCount;
    this.performanceMetrics.errorRate = totalRequests > 0
      ? (this.performanceMetrics.errorCount / totalRequests) * 100
      : 0;

    // Cache hit rate
    const totalCacheRequests = this.performanceMetrics.cacheHitRate + this.performanceMetrics.cacheMissRate;
    if (totalCacheRequests > 0) {
      this.performanceMetrics.cacheHitRate = (this.performanceMetrics.cacheHitRate / totalCacheRequests) * 100;
    }

    // Cleanup old samples
    this.cleanupSamples();
  }

  private cleanupSamples(): void {
    if (this.requestTimes.length > this.MAX_SAMPLES) {
      this.requestTimes = this.requestTimes.slice(-this.MAX_SAMPLES);
    }
    if (this.connectionLifetimes.length > this.MAX_SAMPLES) {
      this.connectionLifetimes = this.connectionLifetimes.slice(-this.MAX_SAMPLES);
    }
    if (this.queryTimes.length > this.MAX_SAMPLES) {
      this.queryTimes = this.queryTimes.slice(-this.MAX_SAMPLES);
    }
  }

  private async performHealthCheck(): Promise<void> {
    this.healthMetrics.lastHealthCheck = new Date();

    // Check external dependencies
    await this.checkDependencies();

    // Update service status based on metrics
    this.updateServiceStatus();

    // Generate alerts if needed
    this.generateAlerts();

    this.emit('health:checked', this.healthMetrics);
  }

  private async checkDependencies(): Promise<void> {
    try {
      // MongoDB check
      this.healthMetrics.dependencies.mongodb = await this.checkMongoDB();

      // Redis check
      this.healthMetrics.dependencies.redis = await this.checkRedis();

      // ChromaDB check
      this.healthMetrics.dependencies.chroma = await this.checkChroma();

      // MinIO check
      this.healthMetrics.dependencies.minio = await this.checkMinIO();

      // AWS check
      this.healthMetrics.dependencies.aws = await this.checkAWS();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  private async checkMongoDB(): Promise<boolean> {
    try {
      // This would be implemented with actual MongoDB connection check
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      // This would be implemented with actual Redis connection check
      return true;
    } catch {
      return false;
    }
  }

  private async checkChroma(): Promise<boolean> {
    try {
      // This would be implemented with actual ChromaDB health check
      return true;
    } catch {
      return false;
    }
  }

  private async checkMinIO(): Promise<boolean> {
    try {
      // This would be implemented with actual MinIO health check
      return true;
    } catch {
      return false;
    }
  }

  private async checkAWS(): Promise<boolean> {
    try {
      // This would be implemented with actual AWS service check
      return true;
    } catch {
      return false;
    }
  }

  private updateServiceStatus(): void {
    // Overall system health
    const allDependenciesHealthy = Object.values(this.healthMetrics.dependencies).every(status => status);
    const errorRate = this.performanceMetrics.errorRate;
    const memoryUsage = this.performanceMetrics.memoryUsage.heapUsed / this.performanceMetrics.memoryUsage.heapTotal;

    if (!allDependenciesHealthy || errorRate > 5) {
      this.healthMetrics.servicesStatus.set('system', 'down');
    } else if (errorRate > 1 || memoryUsage > 0.9) {
      this.healthMetrics.servicesStatus.set('system', 'degraded');
    } else {
      this.healthMetrics.servicesStatus.set('system', 'healthy');
    }
  }

  private generateAlerts(): void {
    const alerts: typeof this.healthMetrics.alerts = [];

    // High error rate alert
    if (this.performanceMetrics.errorRate > 5) {
      alerts.push({
        level: 'critical',
        message: `High error rate detected: ${this.performanceMetrics.errorRate.toFixed(2)}%`,
        timestamp: new Date(),
        service: 'api',
      });
    }

    // High memory usage alert
    const memoryUsage = this.performanceMetrics.memoryUsage.heapUsed / this.performanceMetrics.memoryUsage.heapTotal;
    if (memoryUsage > 0.9) {
      alerts.push({
        level: 'warning',
        message: `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
        timestamp: new Date(),
        service: 'system',
      });
    }

    // Slow response time alert
    if (this.performanceMetrics.responseTime.p95 > 2000) { // 2 seconds
      alerts.push({
        level: 'warning',
        message: `Slow response times: P95 = ${this.performanceMetrics.responseTime.p95}ms`,
        timestamp: new Date(),
        service: 'api',
      });
    }

    // Service dependency alerts
    Object.entries(this.healthMetrics.dependencies).forEach(([service, healthy]) => {
      if (!healthy) {
        alerts.push({
          level: 'critical',
          message: `Service dependency down: ${service}`,
          timestamp: new Date(),
          service,
        });
      }
    });

    // Keep only recent alerts (last 100)
    this.healthMetrics.alerts = [...alerts, ...this.healthMetrics.alerts].slice(0, 100);
  }

  // Public methods for recording metrics
  recordRequest(duration: number): void {
    this.performanceMetrics.requestCount++;
    this.requestTimes.push(duration);
  }

  recordError(errorType: string): void {
    this.performanceMetrics.errorCount++;
    const current = this.performanceMetrics.errorsByType.get(errorType) || 0;
    this.performanceMetrics.errorsByType.set(errorType, current + 1);
  }

  recordWebSocketConnection(): void {
    this.performanceMetrics.activeConnections++;
  }

  recordWebSocketDisconnection(lifetime: number): void {
    this.performanceMetrics.activeConnections = Math.max(0, this.performanceMetrics.activeConnections - 1);
    this.connectionLifetimes.push(lifetime);
  }

  recordDatabaseQuery(duration: number): void {
    this.performanceMetrics.dbQueryCount++;
    this.queryTimes.push(duration);
  }

  recordCacheHit(): void {
    this.performanceMetrics.cacheHitRate++;
  }

  recordCacheMiss(): void {
    this.performanceMetrics.cacheMissRate++;
  }

  recordBusinessEvent(event: string, data?: any): void {
    switch (event) {
      case 'user:active':
        this.businessMetrics.activeUsers++;
        break;
      case 'user:new':
        this.businessMetrics.newUsersToday++;
        break;
      case 'chat:created':
        this.businessMetrics.newChatsToday++;
        this.businessMetrics.totalChats++;
        break;
      case 'agent:used':
        if (data?.agentId) {
          const current = this.businessMetrics.agentUsage.get(data.agentId) || 0;
          this.businessMetrics.agentUsage.set(data.agentId, current + 1);
        }
        break;
      case 'tool:used':
        if (data?.toolName) {
          const current = this.businessMetrics.toolUsage.get(data.toolName) || 0;
          this.businessMetrics.toolUsage.set(data.toolName, current + 1);
        }
        break;
      case 'document:processed':
        this.businessMetrics.documentsProcessed++;
        break;
      case 'search:query':
        this.businessMetrics.searchQueries++;
        break;
    }
  }

  // Getters
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getBusinessMetrics(): BusinessMetrics {
    return { ...this.businessMetrics };
  }

  getHealthMetrics(): HealthMetrics {
    return { ...this.healthMetrics };
  }

  getAllMetrics() {
    return {
      performance: this.getPerformanceMetrics(),
      business: this.getBusinessMetrics(),
      health: this.getHealthMetrics(),
      timestamp: new Date(),
    };
  }

  // Export metrics for external monitoring tools
  getPrometheusMetrics(): string {
    const metrics = this.getAllMetrics();

    return `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.performance.requestCount}

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} ${this.requestTimes.filter(t => t <= 100).length}
http_request_duration_seconds_bucket{le="0.5"} ${this.requestTimes.filter(t => t <= 500).length}
http_request_duration_seconds_bucket{le="1.0"} ${this.requestTimes.filter(t => t <= 1000).length}
http_request_duration_seconds_bucket{le="2.0"} ${this.requestTimes.filter(t => t <= 2000).length}
http_request_duration_seconds_bucket{le="+Inf"} ${this.requestTimes.length}

# HELP http_errors_total Total number of HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.performance.errorCount}

# HELP websocket_connections_active Current active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active ${metrics.performance.activeConnections}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes{type="heap_used"} ${metrics.performance.memoryUsage.heapUsed}
memory_usage_bytes{type="heap_total"} ${metrics.performance.memoryUsage.heapTotal}
memory_usage_bytes{type="rss"} ${metrics.performance.memoryUsage.rss}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${metrics.health.uptime}

# HELP active_users_total Current active users
# TYPE active_users_total gauge
active_users_total ${metrics.business.activeUsers}

# HELP chats_created_today_total Chats created today
# TYPE chats_created_today_total counter
chats_created_today_total ${metrics.business.newChatsToday}
    `.trim();
  }

  // Cleanup
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
  }
}

export default new MetricsService();