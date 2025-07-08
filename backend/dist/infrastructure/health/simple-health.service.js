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
var SimpleHealthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleHealthService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let SimpleHealthService = SimpleHealthService_1 = class SimpleHealthService {
    constructor(mongoConnection) {
        this.mongoConnection = mongoConnection;
        this.logger = new common_1.Logger(SimpleHealthService_1.name);
        this.startTime = Date.now();
    }
    async getHealthStatus() {
        const startTime = Date.now();
        this.logger.debug('🏥 Starting health check...');
        const checks = [];
        checks.push(await this.checkDatabase());
        checks.push(await this.checkMemory());
        checks.push(await this.checkSystem());
        const hasFailures = checks.some(check => check.status === 'fail');
        const hasWarnings = checks.some(check => check.status === 'warn');
        let overallStatus;
        if (hasFailures) {
            overallStatus = 'unhealthy';
        }
        else if (hasWarnings) {
            overallStatus = 'degraded';
        }
        else {
            overallStatus = 'healthy';
        }
        const totalDuration = Date.now() - startTime;
        this.logger.log(`🏥 Health check completed in ${totalDuration}ms - Status: ${overallStatus}`);
        return {
            status: overallStatus,
            timestamp: new Date(),
            version: '1.0.0',
            uptime: Date.now() - this.startTime,
            checks
        };
    }
    async getSimpleHealth() {
        try {
            const isDbHealthy = this.mongoConnection.readyState === 1;
            return {
                status: isDbHealthy ? 'ok' : 'error',
                timestamp: new Date()
            };
        }
        catch {
            return {
                status: 'error',
                timestamp: new Date()
            };
        }
    }
    async checkDatabase() {
        const startTime = Date.now();
        try {
            const isConnected = this.mongoConnection.readyState === 1;
            if (!isConnected) {
                return {
                    name: 'database',
                    status: 'fail',
                    duration: Date.now() - startTime,
                    message: `Database not connected. State: ${this.mongoConnection.readyState}`
                };
            }
            const duration = Date.now() - startTime;
            const isHealthy = duration < 1000;
            return {
                name: 'database',
                status: isHealthy ? 'pass' : 'warn',
                duration,
                message: isHealthy ? 'Database connection healthy' : 'Database responding slowly'
            };
        }
        catch {
            return {
                name: 'database',
                status: 'fail',
                duration: Date.now() - startTime,
                message: 'Database check failed'
            };
        }
    }
    async checkMemory() {
        const startTime = Date.now();
        try {
            const memoryUsage = process.memoryUsage();
            const totalMemory = memoryUsage.heapTotal;
            const usedMemory = memoryUsage.heapUsed;
            const memoryUsagePercent = (usedMemory / totalMemory) * 100;
            let status;
            let message;
            if (memoryUsagePercent > 90) {
                status = 'fail';
                message = `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`;
            }
            else if (memoryUsagePercent > 75) {
                status = 'warn';
                message = `High memory usage: ${memoryUsagePercent.toFixed(1)}%`;
            }
            else {
                status = 'pass';
                message = `Memory usage normal: ${memoryUsagePercent.toFixed(1)}%`;
            }
            return {
                name: 'memory',
                status,
                duration: Date.now() - startTime,
                message
            };
        }
        catch {
            return {
                name: 'memory',
                status: 'fail',
                duration: Date.now() - startTime,
                message: 'Memory check failed'
            };
        }
    }
    async checkSystem() {
        const startTime = Date.now();
        try {
            const uptime = process.uptime();
            const uptimeHours = uptime / 3600;
            let status;
            let message;
            if (uptimeHours < 0.1) {
                status = 'warn';
                message = `System recently started: ${uptimeHours.toFixed(1)} hours`;
            }
            else {
                status = 'pass';
                message = `System running: ${uptimeHours.toFixed(1)} hours`;
            }
            return {
                name: 'system',
                status,
                duration: Date.now() - startTime,
                message
            };
        }
        catch {
            return {
                name: 'system',
                status: 'fail',
                duration: Date.now() - startTime,
                message: 'System check failed'
            };
        }
    }
    async getSystemMetrics() {
        return {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            version: '1.0.0',
            nodeVersion: process.version
        };
    }
};
exports.SimpleHealthService = SimpleHealthService;
exports.SimpleHealthService = SimpleHealthService = SimpleHealthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Connection])
], SimpleHealthService);
//# sourceMappingURL=simple-health.service.js.map