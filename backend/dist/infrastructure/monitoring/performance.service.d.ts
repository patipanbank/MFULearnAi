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
export declare class PerformanceService {
    private readonly logger;
    private metrics;
    private readonly maxMetrics;
    private totalRequests;
    private requestTimes;
    private errors;
    private connections;
    constructor();
    getSystemPerformance(): Promise<SystemPerformance>;
    getRequestMetrics(): RequestMetrics;
    recordRequest(responseTime: number, isError?: boolean): void;
    setConnectionCount(count: number): void;
    addMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void;
    getMetrics(name?: string, since?: Date): PerformanceMetric[];
    getMetricsSummary(name: string, since?: Date): {
        count: number;
        average: number;
        min: number;
        max: number;
        latest: number;
    };
    getPerformanceAlerts(): string[];
    clearOldMetrics(olderThan: Date): number;
    getPerformanceReport(): Promise<{
        system: SystemPerformance;
        requests: RequestMetrics;
        alerts: string[];
        topMetrics: PerformanceMetric[];
    }>;
    private startMonitoring;
    private getLoadAverage;
    private measureEventLoopDelay;
}
