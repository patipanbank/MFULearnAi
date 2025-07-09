import { SimpleHealthService } from './simple-health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: SimpleHealthService);
    check(): Promise<{
        status: string;
        timestamp: Date;
    }>;
    detailed(): Promise<import("./simple-health.service").SimpleHealthStatus>;
}
