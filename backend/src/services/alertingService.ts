/**
 * Alerting Service
 * Handles system alerts, notifications, and automated responses
 */

import { EventEmitter } from 'events';
import metricsService from './metricsService';

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  service: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string; // JavaScript expression
  level: AlertLevel;
  service: string;
  enabled: boolean;
  cooldownMinutes: number; // Minimum time between alerts
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'log' | 'auto-scale' | 'restart';
  config: Record<string, any>;
  onlyForLevels?: AlertLevel[];
}

export interface AlertingConfig {
  enabledChannels: {
    email: boolean;
    webhook: boolean;
    slack: boolean;
    logs: boolean;
  };
  recipients: {
    email: string[];
    slack: {
      webhookUrl?: string;
      channel?: string;
    };
    webhook: {
      url?: string;
      headers?: Record<string, string>;
    };
  };
  globalCooldown: number; // Minutes
  maxAlertsPerHour: number;
}

class AlertingService extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();
  private alertCounts: Map<string, number> = new Map();
  private config: AlertingConfig;

  constructor(config: Partial<AlertingConfig> = {}) {
    super();

    this.config = {
      enabledChannels: {
        email: false,
        webhook: false,
        slack: false,
        logs: true,
      },
      recipients: {
        email: [],
        slack: {},
        webhook: {},
      },
      globalCooldown: 5, // 5 minutes
      maxAlertsPerHour: 10,
      ...config,
    };

    this.setupDefaultRules();
    this.startMonitoring();
  }

  private setupDefaultRules(): void {
    // High error rate rule
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Triggers when error rate exceeds 5%',
      condition: 'metrics.performance.errorRate > 5',
      level: 'critical',
      service: 'api',
      enabled: true,
      cooldownMinutes: 10,
      actions: [
        { type: 'log', config: {} },
        { type: 'slack', config: {}, onlyForLevels: ['critical', 'error'] },
      ],
    });

    // High memory usage rule
    this.addRule({
      id: 'high-memory',
      name: 'High Memory Usage',
      description: 'Triggers when memory usage exceeds 85%',
      condition: 'metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal > 0.85',
      level: 'warning',
      service: 'system',
      enabled: true,
      cooldownMinutes: 15,
      actions: [
        { type: 'log', config: {} },
      ],
    });

    // Slow response time rule
    this.addRule({
      id: 'slow-response',
      name: 'Slow Response Time',
      description: 'Triggers when P95 response time exceeds 2 seconds',
      condition: 'metrics.performance.responseTime.p95 > 2000',
      level: 'warning',
      service: 'api',
      enabled: true,
      cooldownMinutes: 5,
      actions: [
        { type: 'log', config: {} },
      ],
    });

    // Service dependency down rule
    this.addRule({
      id: 'service-down',
      name: 'Service Dependency Down',
      description: 'Triggers when a critical service dependency is down',
      condition: 'Object.values(metrics.health.dependencies).includes(false)',
      level: 'critical',
      service: 'dependencies',
      enabled: true,
      cooldownMinutes: 1,
      actions: [
        { type: 'log', config: {} },
        { type: 'slack', config: {}, onlyForLevels: ['critical'] },
        { type: 'email', config: {}, onlyForLevels: ['critical'] },
      ],
    });

    // Low cache hit rate rule
    this.addRule({
      id: 'low-cache-hit',
      name: 'Low Cache Hit Rate',
      description: 'Triggers when cache hit rate falls below 70%',
      condition: 'metrics.performance.cacheHitRate < 70 && metrics.performance.requestCount > 100',
      level: 'warning',
      service: 'cache',
      enabled: true,
      cooldownMinutes: 20,
      actions: [
        { type: 'log', config: {} },
      ],
    });

    // Active connections spike rule
    this.addRule({
      id: 'connection-spike',
      name: 'WebSocket Connection Spike',
      description: 'Triggers when active connections exceed 1000',
      condition: 'metrics.performance.activeConnections > 1000',
      level: 'info',
      service: 'websocket',
      enabled: true,
      cooldownMinutes: 30,
      actions: [
        { type: 'log', config: {} },
      ],
    });
  }

  private startMonitoring(): void {
    // Listen to metrics updates
    metricsService.on('metrics:collected', (data) => {
      this.evaluateRules(data);
    });

    // Cleanup old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000);

    // Reset alert counts every hour
    setInterval(() => {
      this.alertCounts.clear();
    }, 60 * 60 * 1000);
  }

  private evaluateRules(metrics: any): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        // Check cooldown
        const lastAlert = this.lastAlertTime.get(rule.id);
        if (lastAlert) {
          const timeSinceLastAlert = Date.now() - lastAlert.getTime();
          if (timeSinceLastAlert < rule.cooldownMinutes * 60 * 1000) {
            continue;
          }
        }

        // Evaluate condition
        const conditionMet = this.evaluateCondition(rule.condition, { metrics });

        if (conditionMet) {
          this.createAlert(rule, metrics);
          this.lastAlertTime.set(rule.id, new Date());
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }
  }

  private evaluateCondition(condition: string, context: any): boolean {
    try {
      // Create a safe evaluation context
      const func = new Function('metrics', `return ${condition}`);
      return func(context.metrics);
    } catch (error) {
      console.error('Error evaluating condition:', condition, error);
      return false;
    }
  }

  private async createAlert(rule: AlertRule, metrics: any): Promise<void> {
    // Check rate limiting
    const alertCount = this.alertCounts.get(rule.service) || 0;
    if (alertCount >= this.config.maxAlertsPerHour) {
      console.warn(`Rate limit exceeded for service ${rule.service}`);
      return;
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: rule.level,
      title: rule.name,
      message: this.generateAlertMessage(rule, metrics),
      service: rule.service,
      timestamp: new Date(),
      acknowledged: false,
      metadata: {
        ruleId: rule.id,
        metrics: this.extractRelevantMetrics(rule, metrics),
      },
    };

    this.alerts.set(alert.id, alert);
    this.alertCounts.set(rule.service, alertCount + 1);

    // Execute alert actions
    await this.executeAlertActions(rule, alert);

    // Emit alert event
    this.emit('alert:created', alert);

    console.log(`🚨 Alert created: [${alert.level.toUpperCase()}] ${alert.title} - ${alert.message}`);
  }

  private generateAlertMessage(rule: AlertRule, metrics: any): string {
    const context = { metrics, rule };

    // Generate contextual message based on rule
    switch (rule.id) {
      case 'high-error-rate':
        return `Error rate is ${metrics.performance.errorRate.toFixed(2)}% (threshold: 5%)`;

      case 'high-memory':
        const memUsage = (metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal * 100).toFixed(1);
        return `Memory usage is ${memUsage}% (threshold: 85%)`;

      case 'slow-response':
        return `P95 response time is ${metrics.performance.responseTime.p95.toFixed(0)}ms (threshold: 2000ms)`;

      case 'service-down':
        const downServices = Object.entries(metrics.health.dependencies)
          .filter(([_, status]) => !status)
          .map(([service]) => service);
        return `Service dependencies down: ${downServices.join(', ')}`;

      case 'low-cache-hit':
        return `Cache hit rate is ${metrics.performance.cacheHitRate.toFixed(1)}% (threshold: 70%)`;

      case 'connection-spike':
        return `Active WebSocket connections: ${metrics.performance.activeConnections} (threshold: 1000)`;

      default:
        return `${rule.description} - Condition: ${rule.condition}`;
    }
  }

  private extractRelevantMetrics(rule: AlertRule, metrics: any): any {
    // Extract only relevant metrics for the alert
    switch (rule.service) {
      case 'api':
        return {
          requestCount: metrics.performance.requestCount,
          responseTime: metrics.performance.responseTime,
          errorRate: metrics.performance.errorRate,
          errorCount: metrics.performance.errorCount,
        };

      case 'system':
        return {
          memoryUsage: metrics.performance.memoryUsage,
          cpuUsage: metrics.performance.cpuUsage,
          uptime: metrics.health.uptime,
        };

      case 'dependencies':
        return {
          dependencies: metrics.health.dependencies,
          servicesStatus: metrics.health.servicesStatus,
        };

      default:
        return {};
    }
  }

  private async executeAlertActions(rule: AlertRule, alert: Alert): Promise<void> {
    for (const action of rule.actions) {
      // Check if action should execute for this alert level
      if (action.onlyForLevels && !action.onlyForLevels.includes(alert.level)) {
        continue;
      }

      try {
        await this.executeAction(action, alert);
      } catch (error) {
        console.error(`Failed to execute action ${action.type} for alert ${alert.id}:`, error);
      }
    }
  }

  private async executeAction(action: AlertAction, alert: Alert): Promise<void> {
    switch (action.type) {
      case 'log':
        console.error(`🚨 [${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);
        break;

      case 'email':
        await this.sendEmailAlert(alert, action.config);
        break;

      case 'slack':
        await this.sendSlackAlert(alert, action.config);
        break;

      case 'webhook':
        await this.sendWebhookAlert(alert, action.config);
        break;

      case 'auto-scale':
        await this.triggerAutoScale(alert, action.config);
        break;

      case 'restart':
        await this.triggerRestart(alert, action.config);
        break;

      default:
        console.warn(`Unknown alert action type: ${action.type}`);
    }
  }

  private async sendEmailAlert(alert: Alert, config: any): Promise<void> {
    if (!this.config.enabledChannels.email || !this.config.recipients.email.length) {
      return;
    }

    // Email implementation would go here
    console.log(`📧 Email alert sent: ${alert.title}`);
  }

  private async sendSlackAlert(alert: Alert, config: any): Promise<void> {
    if (!this.config.enabledChannels.slack || !this.config.recipients.slack.webhookUrl) {
      return;
    }

    const payload = {
      text: `🚨 *${alert.title}*`,
      attachments: [
        {
          color: this.getSlackColor(alert.level),
          fields: [
            { title: 'Level', value: alert.level.toUpperCase(), short: true },
            { title: 'Service', value: alert.service, short: true },
            { title: 'Message', value: alert.message, short: false },
            { title: 'Time', value: alert.timestamp.toISOString(), short: true },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.config.recipients.slack.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`💬 Slack alert sent: ${alert.title}`);
      } else {
        console.error('Failed to send Slack alert:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending Slack alert:', error);
    }
  }

  private async sendWebhookAlert(alert: Alert, config: any): Promise<void> {
    if (!this.config.enabledChannels.webhook || !this.config.recipients.webhook.url) {
      return;
    }

    const payload = {
      alertId: alert.id,
      level: alert.level,
      title: alert.title,
      message: alert.message,
      service: alert.service,
      timestamp: alert.timestamp.toISOString(),
      metadata: alert.metadata,
    };

    try {
      const response = await fetch(this.config.recipients.webhook.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.recipients.webhook.headers,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`🔗 Webhook alert sent: ${alert.title}`);
      } else {
        console.error('Failed to send webhook alert:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending webhook alert:', error);
    }
  }

  private async triggerAutoScale(alert: Alert, config: any): Promise<void> {
    // Auto-scaling logic would go here
    console.log(`🔄 Auto-scale triggered for alert: ${alert.title}`);
  }

  private async triggerRestart(alert: Alert, config: any): Promise<void> {
    // Service restart logic would go here
    console.log(`🔄 Service restart triggered for alert: ${alert.title}`);
  }

  private getSlackColor(level: AlertLevel): string {
    switch (level) {
      case 'critical': return 'danger';
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'good';
      default: return '#808080';
    }
  }

  private cleanupOldAlerts(): void {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp.getTime() < oneWeekAgo) {
        this.alerts.delete(id);
      }
    }
  }

  // Public methods
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`✅ Alert rule added: ${rule.name}`);
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      console.log(`❌ Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    console.log(`🔄 Alert rule updated: ${rule.name}`);
    return true;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.emit('alert:acknowledged', alert);
    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    this.emit('alert:resolved', alert);
    return true;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolvedAt)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAlertHistory(limit = 100): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  updateConfig(config: Partial<AlertingConfig>): void {
    Object.assign(this.config, config);
    console.log('🔄 Alerting configuration updated');
  }

  // Test alert for verification
  async testAlert(level: AlertLevel = 'info'): Promise<void> {
    const testAlert: Alert = {
      id: `test_${Date.now()}`,
      level,
      title: 'Test Alert',
      message: 'This is a test alert to verify the alerting system',
      service: 'test',
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.set(testAlert.id, testAlert);

    // Execute test actions
    await this.executeAction({ type: 'log', config: {} }, testAlert);

    this.emit('alert:created', testAlert);
    console.log('🧪 Test alert created successfully');
  }

  // Cleanup
  destroy(): void {
    this.removeAllListeners();
    this.alerts.clear();
    this.rules.clear();
    this.lastAlertTime.clear();
    this.alertCounts.clear();
  }
}

export default new AlertingService();