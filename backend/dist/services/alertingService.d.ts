import { EventEmitter } from 'events';
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
    condition: string;
    level: AlertLevel;
    service: string;
    enabled: boolean;
    cooldownMinutes: number;
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
    globalCooldown: number;
    maxAlertsPerHour: number;
}
declare class AlertingService extends EventEmitter {
    private alerts;
    private rules;
    private lastAlertTime;
    private alertCounts;
    private config;
    constructor(config?: Partial<AlertingConfig>);
    private setupDefaultRules;
    private startMonitoring;
    private evaluateRules;
    private evaluateCondition;
    private createAlert;
    private generateAlertMessage;
    private extractRelevantMetrics;
    private executeAlertActions;
    private executeAction;
    private sendEmailAlert;
    private sendSlackAlert;
    private sendWebhookAlert;
    private triggerAutoScale;
    private triggerRestart;
    private getSlackColor;
    private cleanupOldAlerts;
    addRule(rule: AlertRule): void;
    removeRule(ruleId: string): boolean;
    updateRule(ruleId: string, updates: Partial<AlertRule>): boolean;
    acknowledgeAlert(alertId: string): boolean;
    resolveAlert(alertId: string): boolean;
    getActiveAlerts(): Alert[];
    getAlertHistory(limit?: number): Alert[];
    getRules(): AlertRule[];
    updateConfig(config: Partial<AlertingConfig>): void;
    testAlert(level?: AlertLevel): Promise<void>;
    destroy(): void;
}
declare const _default: AlertingService;
export default _default;
//# sourceMappingURL=alertingService.d.ts.map