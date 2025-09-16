/**
 * Monitoring Configuration
 * Sets up comprehensive monitoring, metrics, and alerting for the application
 */

import { Express } from 'express';
import { metricsMiddleware, databaseMetricsWrapper, websocketMetrics } from '../middleware/metricsMiddleware';
import metricsRoutes from '../routes/metricsRoutes';
import metricsService from '../services/metricsService';
import alertingService from '../services/alertingService';

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableAlerting: boolean;
  enablePrometheusEndpoint: boolean;
  alerting: {
    enableSlack: boolean;
    slackWebhookUrl?: string;
    enableEmail: boolean;
    emailRecipients: string[];
    enableWebhook: boolean;
    webhookUrl?: string;
  };
  metrics: {
    collectInterval: number;
    retentionPeriod: number;
  };
}

export class MonitoringSetup {
  private app: Express;
  private config: MonitoringConfig;

  constructor(app: Express, config: Partial<MonitoringConfig> = {}) {
    this.app = app;
    this.config = {
      enableMetrics: true,
      enableAlerting: true,
      enablePrometheusEndpoint: true,
      alerting: {
        enableSlack: false,
        enableEmail: false,
        emailRecipients: [],
        enableWebhook: false,
      },
      metrics: {
        collectInterval: 30000, // 30 seconds
        retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
      ...config,
    };
  }

  public initialize(): void {
    console.log('🔧 Initializing monitoring system...');

    if (this.config.enableMetrics) {
      this.setupMetrics();
    }

    if (this.config.enableAlerting) {
      this.setupAlerting();
    }

    this.setupRoutes();
    this.setupEventHandlers();

    console.log('✅ Monitoring system initialized successfully');
  }

  private setupMetrics(): void {
    console.log('📊 Setting up metrics collection...');

    // Add metrics middleware to all routes
    this.app.use(metricsMiddleware);

    // Setup metrics event listeners
    metricsService.on('metrics:collected', (data) => {
      this.logMetricsSummary(data);
    });

    console.log('✅ Metrics collection enabled');
  }

  private setupAlerting(): void {
    console.log('🚨 Setting up alerting system...');

    // Configure alerting service
    alertingService.updateConfig({
      enabledChannels: {
        email: this.config.alerting.enableEmail,
        slack: this.config.alerting.enableSlack,
        webhook: this.config.alerting.enableWebhook,
        logs: true,
      },
      recipients: {
        email: this.config.alerting.emailRecipients,
        slack: {
          webhookUrl: this.config.alerting.slackWebhookUrl,
        },
        webhook: {
          url: this.config.alerting.webhookUrl,
        },
      },
    });

    // Setup alert event listeners
    alertingService.on('alert:created', (alert) => {
      console.log(`🚨 ALERT [${alert.level.toUpperCase()}]: ${alert.title} - ${alert.message}`);
    });

    alertingService.on('alert:acknowledged', (alert) => {
      console.log(`✅ Alert acknowledged: ${alert.title}`);
    });

    alertingService.on('alert:resolved', (alert) => {
      console.log(`✅ Alert resolved: ${alert.title}`);
    });

    console.log('✅ Alerting system enabled');
  }

  private setupRoutes(): void {
    console.log('🛣️ Setting up monitoring routes...');

    // Add metrics routes
    this.app.use('/api', metricsRoutes);

    console.log('✅ Monitoring routes configured');
  }

  private setupEventHandlers(): void {
    // Handle process events for graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📊 Shutting down monitoring system...');
      metricsService.destroy();
      alertingService.destroy();
    });

    process.on('SIGINT', () => {
      console.log('📊 Shutting down monitoring system...');
      metricsService.destroy();
      alertingService.destroy();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      metricsService.recordError('uncaught_exception');

      // Create critical alert
      alertingService.testAlert('critical');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      metricsService.recordError('unhandled_rejection');

      // Create error alert
      alertingService.testAlert('error');
    });
  }

  private logMetricsSummary(data: any): void {
    const { performance, business, health } = data;

    // Log key metrics every few minutes (to avoid spam)
    const logInterval = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    // Use a simple in-memory store for last log time
    if (!this.lastLogTime || (now - this.lastLogTime) >= logInterval) {
      console.log('📊 Metrics Summary:', {
        requests: performance.requestCount,
        errorRate: `${performance.errorRate.toFixed(2)}%`,
        avgResponseTime: `${performance.responseTime.avg.toFixed(0)}ms`,
        activeConnections: performance.activeConnections,
        memoryUsage: `${((performance.memoryUsage.heapUsed / performance.memoryUsage.heapTotal) * 100).toFixed(1)}%`,
        uptime: `${(health.uptime / 3600).toFixed(1)}h`,
        activeUsers: business.activeUsers,
        chatsToday: business.newChatsToday,
      });

      this.lastLogTime = now;
    }
  }

  private lastLogTime: number = 0;

  // Public methods for external use
  public getMetrics() {
    return metricsService.getAllMetrics();
  }

  public getAlerts() {
    return alertingService.getActiveAlerts();
  }

  public createCustomAlert(level: any, title: string, message: string, service: string) {
    // Implementation would create a custom alert
    console.log(`Creating custom alert: ${level} - ${title}`);
  }

  public addCustomMetricsRule(rule: any) {
    alertingService.addRule(rule);
  }

  // Utility methods for integration with other services
  public recordDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
    return databaseMetricsWrapper(operation);
  }

  public recordWebSocketConnection() {
    websocketMetrics.onConnection();
  }

  public recordWebSocketDisconnection(connectionStartTime: number) {
    websocketMetrics.onDisconnection(connectionStartTime);
  }

  public recordBusinessEvent(event: string, data?: any) {
    metricsService.recordBusinessEvent(event, data);
  }

  public recordPerformanceMetric(metricName: string, value: number) {
    // Custom performance metric recording
    console.log(`📈 Custom metric: ${metricName} = ${value}`);
  }
}

// Export default configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  enableMetrics: process.env.NODE_ENV === 'production',
  enableAlerting: process.env.NODE_ENV === 'production',
  enablePrometheusEndpoint: true,
  alerting: {
    enableSlack: !!process.env.SLACK_WEBHOOK_URL,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    enableEmail: !!process.env.SMTP_HOST,
    emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
    enableWebhook: !!process.env.ALERT_WEBHOOK_URL,
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  },
  metrics: {
    collectInterval: parseInt(process.env.METRICS_INTERVAL || '30000'),
    retentionPeriod: parseInt(process.env.METRICS_RETENTION || '604800000'), // 7 days
  },
};

// Helper function to setup monitoring
export function setupMonitoring(app: Express, config?: Partial<MonitoringConfig>): MonitoringSetup {
  const monitoring = new MonitoringSetup(app, { ...defaultMonitoringConfig, ...config });
  monitoring.initialize();
  return monitoring;
}

export default MonitoringSetup;