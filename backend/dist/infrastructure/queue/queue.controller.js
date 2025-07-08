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
exports.QueueController = void 0;
const common_1 = require("@nestjs/common");
const job_queue_service_1 = require("./job-queue.service");
const jwt_guard_1 = require("../../modules/auth/jwt.guard");
const roles_guard_1 = require("../../modules/auth/roles.guard");
const roles_decorator_1 = require("../../modules/auth/roles.decorator");
let QueueController = class QueueController {
    constructor(jobQueueService) {
        this.jobQueueService = jobQueueService;
    }
    async getQueueStats() {
        const stats = await this.jobQueueService.getQueueStats();
        return {
            message: 'Queue statistics retrieved successfully',
            data: stats
        };
    }
    async getQueueHealth() {
        const health = await this.jobQueueService.getQueueHealth();
        return {
            message: 'Queue health checked successfully',
            data: health
        };
    }
    async getRecentJobs(limit = '20') {
        const jobs = await this.jobQueueService.getRecentJobs(parseInt(limit, 10));
        const jobsData = jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            progress: job.progress,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            delay: job.delay,
            opts: job.opts,
            timestamp: job.timestamp
        }));
        return {
            message: 'Recent jobs retrieved successfully',
            data: jobsData
        };
    }
    async getJob(id) {
        const job = await this.jobQueueService.getJob(id);
        if (!job) {
            return {
                message: 'Job not found',
                data: null
            };
        }
        return {
            message: 'Job retrieved successfully',
            data: {
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                failedReason: job.failedReason,
                delay: job.delay,
                opts: job.opts,
                timestamp: job.timestamp,
                returnvalue: job.returnvalue
            }
        };
    }
    async addDocumentProcessingJob(body) {
        const { collectionId, documentId, filename, fileBuffer, userId, priority } = body;
        const buffer = Buffer.from(fileBuffer, 'base64');
        const job = await this.jobQueueService.addDocumentProcessingJob(collectionId, documentId, filename, buffer, userId, priority);
        return {
            message: 'Document processing job added successfully',
            data: {
                id: job.id,
                name: job.name,
                priority: job.opts.priority
            }
        };
    }
    async addUsageStatsJob(body) {
        const { userId, action, metadata } = body;
        const job = await this.jobQueueService.addUsageStatsJob(userId, action, metadata);
        return {
            message: 'Usage stats job added successfully',
            data: {
                id: job.id,
                name: job.name
            }
        };
    }
    async addTrainingJob(body) {
        const { modelType, trainingData, configuration, userId } = body;
        const job = await this.jobQueueService.addTrainingJob(modelType, trainingData, configuration, userId);
        return {
            message: 'Training job added successfully',
            data: {
                id: job.id,
                name: job.name
            }
        };
    }
    async addCleanupJob(body) {
        const { cleanupType, olderThan, dryRun = false } = body;
        const olderThanDate = olderThan ? new Date(olderThan) : undefined;
        const job = await this.jobQueueService.addCleanupJob(cleanupType, olderThanDate, dryRun);
        return {
            message: 'Cleanup job added successfully',
            data: {
                id: job.id,
                name: job.name
            }
        };
    }
    async scheduleRecurringJobs(req) {
        await this.jobQueueService.scheduleRecurringJobs();
        return {
            message: 'Recurring jobs scheduled successfully'
        };
    }
    async retryJob(id) {
        await this.jobQueueService.retryJob(id);
        return {
            message: 'Job retry initiated successfully'
        };
    }
    async removeJob(id) {
        await this.jobQueueService.removeJob(id);
        return {
            message: 'Job removed successfully'
        };
    }
    async cleanCompletedJobs(body) {
        const { grace = 100 } = body;
        await this.jobQueueService.cleanCompletedJobs(grace);
        return {
            message: 'Completed jobs cleaned successfully'
        };
    }
    async cleanFailedJobs(body) {
        const { grace = 50 } = body;
        await this.jobQueueService.cleanFailedJobs(grace);
        return {
            message: 'Failed jobs cleaned successfully'
        };
    }
    async pauseQueue() {
        await this.jobQueueService.pauseQueue();
        return {
            message: 'Queue paused successfully'
        };
    }
    async resumeQueue() {
        await this.jobQueueService.resumeQueue();
        return {
            message: 'Queue resumed successfully'
        };
    }
};
exports.QueueController = QueueController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "getQueueStats", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "getQueueHealth", null);
__decorate([
    (0, common_1.Get)('jobs'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "getRecentJobs", null);
__decorate([
    (0, common_1.Get)('jobs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "getJob", null);
__decorate([
    (0, common_1.Post)('jobs/document-processing'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "addDocumentProcessingJob", null);
__decorate([
    (0, common_1.Post)('jobs/usage-stats'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "addUsageStatsJob", null);
__decorate([
    (0, common_1.Post)('jobs/training'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "addTrainingJob", null);
__decorate([
    (0, common_1.Post)('jobs/cleanup'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "addCleanupJob", null);
__decorate([
    (0, common_1.Post)('schedule-recurring'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "scheduleRecurringJobs", null);
__decorate([
    (0, common_1.Post)('jobs/:id/retry'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "retryJob", null);
__decorate([
    (0, common_1.Delete)('jobs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "removeJob", null);
__decorate([
    (0, common_1.Post)('cleanup/completed'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "cleanCompletedJobs", null);
__decorate([
    (0, common_1.Post)('cleanup/failed'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "cleanFailedJobs", null);
__decorate([
    (0, common_1.Post)('pause'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "pauseQueue", null);
__decorate([
    (0, common_1.Post)('resume'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "resumeQueue", null);
exports.QueueController = QueueController = __decorate([
    (0, common_1.Controller)('admin/queue'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('Admin', 'SuperAdmin'),
    __metadata("design:paramtypes", [job_queue_service_1.JobQueueService])
], QueueController);
//# sourceMappingURL=queue.controller.js.map