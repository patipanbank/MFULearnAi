"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultMonitoringConfig = exports.MonitoringSetup = void 0;
exports.setupMonitoring = setupMonitoring;
const metricsMiddleware_1 = require("../middleware/metricsMiddleware");
const metricsRoutes_1 = __importDefault(require("../routes/metricsRoutes"));
const metricsService_1 = __importDefault(require("../services/metricsService"));
const alertingService_1 = __importDefault(require("../services/alertingService"));
class MonitoringSetup {
    constructor(app, config = {}) {
        this.lastLogTime = 0;
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
                collectInterval: 30000,
                retentionPeriod: 7 * 24 * 60 * 60 * 1000,
            },
            ...config,
        };
    }
    initialize() {
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
    setupMetrics() {
        console.log('📊 Setting up metrics collection...');
        this.app.use(metricsMiddleware_1.metricsMiddleware);
        metricsService_1.default.on('metrics:collected', (data) => {
            this.logMetricsSummary(data);
        });
        console.log('✅ Metrics collection enabled');
    }
    setupAlerting() {
        console.log('🚨 Setting up alerting system...');
        alertingService_1.default.updateConfig({
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
        alertingService_1.default.on('alert:created', (alert) => {
            console.log(`🚨 ALERT [${alert.level.toUpperCase()}]: ${alert.title} - ${alert.message}`);
        });
        alertingService_1.default.on('alert:acknowledged', (alert) => {
            console.log(`✅ Alert acknowledged: ${alert.title}`);
        });
        alertingService_1.default.on('alert:resolved', (alert) => {
            console.log(`✅ Alert resolved: ${alert.title}`);
        });
        console.log('✅ Alerting system enabled');
    }
    setupRoutes() {
        console.log('🛣️ Setting up monitoring routes...');
        this.app.use('/api', metricsRoutes_1.default);
        console.log('✅ Monitoring routes configured');
    }
    setupEventHandlers() {
        process.on('SIGTERM', () => {
            console.log('📊 Shutting down monitoring system...');
            metricsService_1.default.destroy();
            alertingService_1.default.destroy();
        });
        process.on('SIGINT', () => {
            console.log('📊 Shutting down monitoring system...');
            metricsService_1.default.destroy();
            alertingService_1.default.destroy();
            process.exit(0);
        });
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            metricsService_1.default.recordError('uncaught_exception');
            alertingService_1.default.testAlert('critical');
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            metricsService_1.default.recordError('unhandled_rejection');
            alertingService_1.default.testAlert('error');
        });
    }
    logMetricsSummary(data) {
        const { performance, business, health } = data;
        const logInterval = 5 * 60 * 1000;
        const now = Date.now();
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
    getMetrics() {
        return metricsService_1.default.getAllMetrics();
    }
    getAlerts() {
        return alertingService_1.default.getActiveAlerts();
    }
    createCustomAlert(level, title, message, service) {
        console.log(`Creating custom alert: ${level} - ${title}`);
    }
    addCustomMetricsRule(rule) {
        alertingService_1.default.addRule(rule);
    }
    recordDatabaseOperation(operation) {
        return (0, metricsMiddleware_1.databaseMetricsWrapper)(operation);
    }
    recordWebSocketConnection() {
        metricsMiddleware_1.websocketMetrics.onConnection();
    }
    recordWebSocketDisconnection(connectionStartTime) {
        metricsMiddleware_1.websocketMetrics.onDisconnection(connectionStartTime);
    }
    recordBusinessEvent(event, data) {
        metricsService_1.default.recordBusinessEvent(event, data);
    }
    recordPerformanceMetric(metricName, value) {
        console.log(`📈 Custom metric: ${metricName} = ${value}`);
    }
}
exports.MonitoringSetup = MonitoringSetup;
exports.defaultMonitoringConfig = {
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
        retentionPeriod: parseInt(process.env.METRICS_RETENTION || '604800000'),
    },
};
function setupMonitoring(app, config) {
    const monitoring = new MonitoringSetup(app, { ...exports.defaultMonitoringConfig, ...config });
    monitoring.initialize();
    return monitoring;
}
exports.default = MonitoringSetup;
//# sourceMappingURL=monitoring.js.map