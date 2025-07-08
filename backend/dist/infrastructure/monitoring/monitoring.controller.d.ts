import { PerformanceService } from './performance.service';
export declare class MonitoringController {
    private readonly performanceService;
    constructor(performanceService: PerformanceService);
    getPerformance(): Promise<{
        message: string;
        data: import("./performance.service").SystemPerformance;
    }>;
    getRequestMetrics(): Promise<{
        message: string;
        data: import("./performance.service").RequestMetrics;
    }>;
    getPerformanceReport(): Promise<{
        message: string;
        data: {
            system: import("./performance.service").SystemPerformance;
            requests: import("./performance.service").RequestMetrics;
            alerts: string[];
            topMetrics: import("./performance.service").PerformanceMetric[];
        };
    }>;
    getMetrics(name?: string, since?: string): Promise<{
        message: string;
        data: {
            metrics: import("./performance.service").PerformanceMetric[];
            count: number;
        };
    }>;
    getMetricsSummary(name: string, since?: string): Promise<{
        message: string;
        error: string;
        data?: undefined;
    } | {
        message: string;
        data: {
            count: number;
            average: number;
            min: number;
            max: number;
            latest: number;
        };
        error?: undefined;
    }>;
    getAlerts(): Promise<{
        message: string;
        data: {
            alerts: string[];
            count: number;
            hasAlerts: boolean;
        };
    }>;
    getDashboard(): Promise<{
        message: string;
        data: {
            overview: {
                performance: import("./performance.service").SystemPerformance;
                requests: import("./performance.service").RequestMetrics;
                alerts: {
                    items: string[];
                    count: number;
                };
            };
            charts: {
                cpu: {
                    timestamp: Date;
                    value: number;
                }[];
                memory: {
                    timestamp: Date;
                    value: number;
                }[];
                responseTime: {
                    timestamp: Date;
                    value: number;
                }[];
            };
            summary: {
                totalMetrics: number;
                systemUptime: number;
                lastUpdated: Date;
            };
        };
    }>;
}
