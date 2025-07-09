"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const performance_service_1 = require("./performance.service");
let MetricsController = class MetricsController {
    constructor(performanceService) {
        this.performanceService = performanceService;
    }
    async getPrometheusMetrics() {
        try {
            const metrics = this.performanceService.getMetrics();
            const prometheusFormat = this.formatMetricsForPrometheus(metrics);
            return prometheusFormat;
        }
        catch (error) {
            return this.getBasicMetrics();
        }
    }
    formatMetricsForPrometheus(metrics) {
        let output = '';
        output += `# HELP mfu_backend_requests_total Total number of requests\n`;
        output += `# TYPE mfu_backend_requests_total counter\n`;
        const memoryUsage = process.memoryUsage();
        output += `# HELP mfu_backend_memory_usage_bytes Memory usage in bytes\n`;
        output += `# TYPE mfu_backend_memory_usage_bytes gauge\n`;
        output += `mfu_backend_memory_usage_bytes{type="rss"} ${memoryUsage.rss}\n`;
        output += `mfu_backend_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}\n`;
        output += `mfu_backend_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}\n`;
        output += `mfu_backend_memory_usage_bytes{type="external"} ${memoryUsage.external}\n`;
        output += `# HELP mfu_backend_uptime_seconds Process uptime in seconds\n`;
        output += `# TYPE mfu_backend_uptime_seconds gauge\n`;
        output += `mfu_backend_uptime_seconds ${process.uptime()}\n`;
        if (process.cpuUsage) {
            const cpuUsage = process.cpuUsage();
            output += `# HELP mfu_backend_cpu_usage_microseconds CPU usage in microseconds\n`;
            output += `# TYPE mfu_backend_cpu_usage_microseconds counter\n`;
            output += `mfu_backend_cpu_usage_microseconds{type="user"} ${cpuUsage.user}\n`;
            output += `mfu_backend_cpu_usage_microseconds{type="system"} ${cpuUsage.system}\n`;
        }
        if (metrics && Array.isArray(metrics)) {
            for (const metric of metrics) {
                if (metric.name && typeof metric.value === 'number') {
                    const metricName = metric.name.replace(/[^a-zA-Z0-9_]/g, '_');
                    output += `# HELP mfu_backend_${metricName} ${metric.description || 'Custom metric'}\n`;
                    output += `# TYPE mfu_backend_${metricName} gauge\n`;
                    output += `mfu_backend_${metricName} ${metric.value}\n`;
                }
            }
        }
        return output;
    }
    getBasicMetrics() {
        let output = '';
        const memoryUsage = process.memoryUsage();
        output += `# HELP mfu_backend_memory_usage_bytes Memory usage in bytes\n`;
        output += `# TYPE mfu_backend_memory_usage_bytes gauge\n`;
        output += `mfu_backend_memory_usage_bytes{type="rss"} ${memoryUsage.rss}\n`;
        output += `mfu_backend_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}\n`;
        output += `mfu_backend_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}\n`;
        output += `mfu_backend_memory_usage_bytes{type="external"} ${memoryUsage.external}\n`;
        output += `# HELP mfu_backend_uptime_seconds Process uptime in seconds\n`;
        output += `# TYPE mfu_backend_uptime_seconds gauge\n`;
        output += `mfu_backend_uptime_seconds ${process.uptime()}\n`;
        return output;
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Content-Type', 'text/plain'),
    (0, swagger_1.ApiOperation)({ summary: 'Get metrics for Prometheus' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Metrics retrieved successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getPrometheusMetrics", null);
exports.MetricsController = MetricsController = __decorate([
    (0, swagger_1.ApiTags)('Metrics'),
    (0, common_1.Controller)('metrics'),
    __metadata("design:paramtypes", [performance_service_1.PerformanceService])
], MetricsController);
//# sourceMappingURL=metrics.controller.js.map