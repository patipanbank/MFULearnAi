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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringController = void 0;
const common_1 = require("@nestjs/common");
const performance_service_1 = require("./performance.service");
const jwt_guard_1 = require("../../modules/auth/jwt.guard");
const roles_guard_1 = require("../../modules/auth/roles.guard");
const roles_decorator_1 = require("../../modules/auth/roles.decorator");
let MonitoringController = class MonitoringController {
    constructor(performanceService) {
        this.performanceService = performanceService;
    }
    async getPerformance() {
        const performance = await this.performanceService.getSystemPerformance();
        return {
            message: 'System performance retrieved successfully',
            data: performance
        };
    }
    async getRequestMetrics() {
        const metrics = this.performanceService.getRequestMetrics();
        return {
            message: 'Request metrics retrieved successfully',
            data: metrics
        };
    }
    async getPerformanceReport() {
        const report = await this.performanceService.getPerformanceReport();
        return {
            message: 'Performance report generated successfully',
            data: report
        };
    }
    async getMetrics(name, since) {
        const sinceDate = since ? new Date(since) : undefined;
        const metrics = this.performanceService.getMetrics(name, sinceDate);
        return {
            message: 'Metrics retrieved successfully',
            data: {
                metrics,
                count: metrics.length
            }
        };
    }
    async getMetricsSummary(name, since) {
        if (!name) {
            return {
                message: 'Metric name is required',
                error: 'name parameter is required'
            };
        }
        const sinceDate = since ? new Date(since) : undefined;
        const summary = this.performanceService.getMetricsSummary(name, sinceDate);
        return {
            message: `Metrics summary for ${name} retrieved successfully`,
            data: summary
        };
    }
    async getAlerts() {
        const alerts = this.performanceService.getPerformanceAlerts();
        return {
            message: 'Performance alerts retrieved successfully',
            data: {
                alerts,
                count: alerts.length,
                hasAlerts: alerts.length > 0
            }
        };
    }
    async getDashboard() {
        const [performance, requests, report, alerts] = await Promise.all([
            this.performanceService.getSystemPerformance(),
            this.performanceService.getRequestMetrics(),
            this.performanceService.getPerformanceReport(),
            this.performanceService.getPerformanceAlerts()
        ]);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const cpuMetrics = this.performanceService.getMetrics('cpu_usage', oneHourAgo);
        const memoryMetrics = this.performanceService.getMetrics('memory_usage_percent', oneHourAgo);
        const responseTimeMetrics = this.performanceService.getMetrics('http_request_duration', oneHourAgo);
        return {
            message: 'Monitoring dashboard data retrieved successfully',
            data: {
                overview: {
                    performance,
                    requests,
                    alerts: {
                        items: alerts,
                        count: alerts.length
                    }
                },
                charts: {
                    cpu: cpuMetrics.map(m => ({
                        timestamp: m.timestamp,
                        value: m.value
                    })),
                    memory: memoryMetrics.map(m => ({
                        timestamp: m.timestamp,
                        value: m.value
                    })),
                    responseTime: responseTimeMetrics.map(m => ({
                        timestamp: m.timestamp,
                        value: m.value
                    }))
                },
                summary: {
                    totalMetrics: report.topMetrics.length,
                    systemUptime: performance.process.uptime,
                    lastUpdated: new Date()
                }
            }
        };
    }
};
exports.MonitoringController = MonitoringController;
__decorate([
    (0, common_1.Get)('performance'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getPerformance", null);
__decorate([
    (0, common_1.Get)('requests'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getRequestMetrics", null);
__decorate([
    (0, common_1.Get)('report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getPerformanceReport", null);
__decorate([
    (0, common_1.Get)('metrics'),
    __param(0, (0, common_1.Query)('name')),
    __param(1, (0, common_1.Query)('since')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Get)('metrics/summary'),
    __param(0, (0, common_1.Query)('name')),
    __param(1, (0, common_1.Query)('since')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getMetricsSummary", null);
__decorate([
    (0, common_1.Get)('alerts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getAlerts", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getDashboard", null);
exports.MonitoringController = MonitoringController = __decorate([
    (0, common_1.Controller)('admin/monitoring'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('Admin', 'SuperAdmin'),
    __metadata("design:paramtypes", [performance_service_1.PerformanceService])
], MonitoringController);
//# sourceMappingURL=monitoring.controller.js.map