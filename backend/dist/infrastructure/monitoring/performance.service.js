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
var PerformanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceService = void 0;
const common_1 = require("@nestjs/common");
let PerformanceService = PerformanceService_1 = class PerformanceService {
    constructor() {
        this.logger = new common_1.Logger(PerformanceService_1.name);
        this.metrics = [];
        this.maxMetrics = 1000;
        this.totalRequests = 0;
        this.requestTimes = [];
        this.errors = 0;
        this.connections = 0;
        this.startMonitoring();
    }
    async getSystemPerformance() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        return {
            timestamp: new Date(),
            cpu: {
                usage: cpuUsage.user / 1000000,
                load: this.getLoadAverage()
            },
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                free: memoryUsage.heapTotal - memoryUsage.heapUsed,
                usagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            process: {
                uptime: process.uptime(),
                pid: process.pid,
                version: process.version,
                memoryUsage
            },
            eventLoop: {
                delay: await this.measureEventLoopDelay()
            }
        };
    }
    getRequestMetrics() {
        const now = Date.now();
        const recentRequests = this.requestTimes.filter(time => now - time < 60000);
        const averageResponseTime = this.requestTimes.length > 0
            ? this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length
            : 0;
        const requestsPerSecond = recentRequests.length / 60;
        const errorRate = this.totalRequests > 0 ? (this.errors / this.totalRequests) * 100 : 0;
        return {
            totalRequests: this.totalRequests,
            activeConnections: this.connections,
            averageResponseTime,
            requestsPerSecond,
            errorRate
        };
    }
    recordRequest(responseTime, isError = false) {
        this.totalRequests++;
        this.requestTimes.push(responseTime);
        if (isError) {
            this.errors++;
        }
        if (this.requestTimes.length > 1000) {
            this.requestTimes = this.requestTimes.slice(-1000);
        }
        this.addMetric('http_request_duration', responseTime, 'ms', {
            status: isError ? 'error' : 'success'
        });
    }
    setConnectionCount(count) {
        this.connections = count;
        this.addMetric('active_connections', count, 'count');
    }
    addMetric(name, value, unit, tags) {
        const metric = {
            name,
            value,
            unit,
            timestamp: new Date(),
            tags
        };
        this.metrics.push(metric);
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
        this.logger.debug(`📊 Metric recorded: ${name} = ${value} ${unit}`);
    }
    getMetrics(name, since) {
        let filteredMetrics = this.metrics;
        if (name) {
            filteredMetrics = filteredMetrics.filter(metric => metric.name === name);
        }
        if (since) {
            filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= since);
        }
        return filteredMetrics;
    }
    getMetricsSummary(name, since) {
        const metrics = this.getMetrics(name, since);
        if (metrics.length === 0) {
            return {
                count: 0,
                average: 0,
                min: 0,
                max: 0,
                latest: 0
            };
        }
        const values = metrics.map(m => m.value);
        const sum = values.reduce((a, b) => a + b, 0);
        return {
            count: metrics.length,
            average: sum / metrics.length,
            min: Math.min(...values),
            max: Math.max(...values),
            latest: values[values.length - 1]
        };
    }
    getPerformanceAlerts() {
        const alerts = [];
        const performance = this.getSystemPerformance();
        performance.then(perf => {
            if (perf.memory.usagePercent > 90) {
                alerts.push(`Critical memory usage: ${perf.memory.usagePercent.toFixed(1)}%`);
            }
            else if (perf.memory.usagePercent > 80) {
                alerts.push(`High memory usage: ${perf.memory.usagePercent.toFixed(1)}%`);
            }
            if (perf.eventLoop.delay > 100) {
                alerts.push(`High event loop delay: ${perf.eventLoop.delay}ms`);
            }
        });
        const requestMetrics = this.getRequestMetrics();
        if (requestMetrics.errorRate > 10) {
            alerts.push(`High error rate: ${requestMetrics.errorRate.toFixed(1)}%`);
        }
        if (requestMetrics.averageResponseTime > 1000) {
            alerts.push(`Slow response time: ${requestMetrics.averageResponseTime.toFixed(0)}ms`);
        }
        return alerts;
    }
    clearOldMetrics(olderThan) {
        const originalLength = this.metrics.length;
        this.metrics = this.metrics.filter(metric => metric.timestamp >= olderThan);
        const removed = originalLength - this.metrics.length;
        this.logger.log(`🧹 Cleared ${removed} old metrics`);
        return removed;
    }
    async getPerformanceReport() {
        const system = await this.getSystemPerformance();
        const requests = this.getRequestMetrics();
        const alerts = this.getPerformanceAlerts();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const topMetrics = this.getMetrics(undefined, oneHourAgo)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 20);
        return {
            system,
            requests,
            alerts,
            topMetrics
        };
    }
    startMonitoring() {
        setInterval(async () => {
            try {
                const performance = await this.getSystemPerformance();
                this.addMetric('cpu_usage', performance.cpu.usage, 'seconds');
                this.addMetric('memory_usage_percent', performance.memory.usagePercent, 'percent');
                this.addMetric('event_loop_delay', performance.eventLoop.delay, 'ms');
                this.addMetric('process_uptime', performance.process.uptime, 'seconds');
            }
            catch (error) {
                this.logger.error('Failed to record system metrics:', error);
            }
        }, 30000);
        setInterval(() => {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            this.clearOldMetrics(oneHourAgo);
        }, 60 * 60 * 1000);
        this.logger.log('📊 Performance monitoring started');
    }
    getLoadAverage() {
        try {
            return process.platform === 'win32' ? [0.5, 0.5, 0.5] : [0, 0, 0];
        }
        catch {
            return [0, 0, 0];
        }
    }
    async measureEventLoopDelay() {
        return new Promise((resolve) => {
            const start = process.hrtime.bigint();
            setImmediate(() => {
                const delta = process.hrtime.bigint() - start;
                resolve(Number(delta) / 1000000);
            });
        });
    }
};
exports.PerformanceService = PerformanceService;
exports.PerformanceService = PerformanceService = PerformanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PerformanceService);
//# sourceMappingURL=performance.service.js.map