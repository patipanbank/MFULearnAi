import { PerformanceService } from './performance.service';
export declare class MetricsController {
    private readonly performanceService;
    constructor(performanceService: PerformanceService);
    getPrometheusMetrics(): Promise<string>;
    private formatMetricsForPrometheus;
    private getBasicMetrics;
}
