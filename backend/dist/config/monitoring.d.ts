import { Express } from 'express';
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
export declare class MonitoringSetup {
    private app;
    private config;
    constructor(app: Express, config?: Partial<MonitoringConfig>);
    initialize(): void;
    private setupMetrics;
    private setupAlerting;
    private setupRoutes;
    private setupEventHandlers;
    private logMetricsSummary;
    private lastLogTime;
    getMetrics(): {
        performance: import("../services/metricsService").PerformanceMetrics;
        business: import("../services/metricsService").BusinessMetrics;
        health: import("../services/metricsService").HealthMetrics;
        timestamp: Date;
    };
    getAlerts(): import("../services/alertingService").Alert[];
    createCustomAlert(level: any, title: string, message: string, service: string): void;
    addCustomMetricsRule(rule: any): void;
    recordDatabaseOperation<T>(operation: () => Promise<T>): Promise<T>;
    recordWebSocketConnection(): void;
    recordWebSocketDisconnection(connectionStartTime: number): void;
    recordBusinessEvent(event: string, data?: any): void;
    recordPerformanceMetric(metricName: string, value: number): void;
}
export declare const defaultMonitoringConfig: MonitoringConfig;
export declare function setupMonitoring(app: Express, config?: Partial<MonitoringConfig>): MonitoringSetup;
export default MonitoringSetup;
//# sourceMappingURL=monitoring.d.ts.map