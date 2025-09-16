import { EventEmitter } from 'events';
export interface PerformanceMetrics {
    requestCount: number;
    requestDuration: number[];
    responseTime: {
        min: number;
        max: number;
        avg: number;
        p95: number;
        p99: number;
    };
    errorCount: number;
    errorRate: number;
    errorsByType: Map<string, number>;
    activeConnections: number;
    messagesPerSecond: number;
    connectionLifetime: number[];
    dbQueryCount: number;
    dbQueryDuration: number[];
    dbConnectionPool: {
        active: number;
        idle: number;
        pending: number;
    };
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    cpuUsage: number;
    cacheHitRate: number;
    cacheMissRate: number;
    cacheSize: number;
}
export interface BusinessMetrics {
    activeUsers: number;
    newUsersToday: number;
    userSessions: number;
    totalChats: number;
    newChatsToday: number;
    messagesPerChat: number;
    avgChatDuration: number;
    agentUsage: Map<string, number>;
    toolUsage: Map<string, number>;
    documentsProcessed: number;
    embeddings: number;
    searchQueries: number;
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
declare class MetricsService extends EventEmitter {
    private performanceMetrics;
    private businessMetrics;
    private healthMetrics;
    private metricsInterval;
    private healthCheckInterval;
    private requestTimes;
    private connectionLifetimes;
    private queryTimes;
    private readonly MAX_SAMPLES;
    private readonly METRICS_INTERVAL;
    private readonly HEALTH_CHECK_INTERVAL;
    constructor();
    private initializeMetrics;
    private startMetricsCollection;
    private startHealthChecks;
    private collectSystemMetrics;
    private calculateDerivedMetrics;
    private cleanupSamples;
    private performHealthCheck;
    private checkDependencies;
    private checkMongoDB;
    private checkRedis;
    private checkChroma;
    private checkMinIO;
    private checkAWS;
    private updateServiceStatus;
    private generateAlerts;
    recordRequest(duration: number): void;
    recordError(errorType: string): void;
    recordWebSocketConnection(): void;
    recordWebSocketDisconnection(lifetime: number): void;
    recordDatabaseQuery(duration: number): void;
    recordCacheHit(): void;
    recordCacheMiss(): void;
    recordBusinessEvent(event: string, data?: any): void;
    getPerformanceMetrics(): PerformanceMetrics;
    getBusinessMetrics(): BusinessMetrics;
    getHealthMetrics(): HealthMetrics;
    getAllMetrics(): {
        performance: PerformanceMetrics;
        business: BusinessMetrics;
        health: HealthMetrics;
        timestamp: Date;
    };
    getPrometheusMetrics(): string;
    destroy(): void;
}
declare const _default: MetricsService;
export default _default;
//# sourceMappingURL=metricsService.d.ts.map