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
export declare class SimpleHealthService {
    private readonly mongoConnection;
    private readonly logger;
    private readonly startTime;
    constructor(mongoConnection: Connection);
    getHealthStatus(): Promise<SimpleHealthStatus>;
    getSimpleHealth(): Promise<{
        status: string;
        timestamp: Date;
    }>;
    private checkDatabase;
    private checkMemory;
    private checkSystem;
    getSystemMetrics(): Promise<{
        memory: NodeJS.MemoryUsage;
        uptime: number;
        version: string;
        nodeVersion: string;
    }>;
}
