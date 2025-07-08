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
var JobQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobQueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
let JobQueueService = JobQueueService_1 = class JobQueueService {
    constructor(queue) {
        this.queue = queue;
        this.logger = new common_1.Logger(JobQueueService_1.name);
    }
    async addJob(jobData, options) {
        const defaultOptions = {
            priority: 0,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
            removeOnComplete: 100,
            removeOnFail: 50,
        };
        const jobOptions = { ...defaultOptions, ...options };
        this.logger.log(`📋 Adding job: ${jobData.type} with priority ${jobOptions.priority}`);
        const job = await this.queue.add(jobData.type, jobData.data, jobOptions);
        return job;
    }
    async addDocumentProcessingJob(collectionId, documentId, filename, fileBuffer, userId, priority = 10) {
        return this.addJob({
            type: 'document_processing',
            data: {
                collectionId,
                documentId,
                filename,
                fileBuffer,
                userId,
                priority
            }
        }, { priority });
    }
    async addEmbeddingJob(texts, options) {
        return this.addJob({
            type: 'embedding',
            data: {
                texts,
                chatId: options === null || options === void 0 ? void 0 : options.chatId,
                messageId: options === null || options === void 0 ? void 0 : options.messageId,
                collectionId: options === null || options === void 0 ? void 0 : options.collectionId,
                batchSize: (options === null || options === void 0 ? void 0 : options.batchSize) || 5
            }
        }, { priority: (options === null || options === void 0 ? void 0 : options.priority) || 5 });
    }
    async addUsageStatsJob(userId, action, metadata) {
        return this.addJob({
            type: 'usage_stats',
            data: {
                userId,
                action,
                metadata,
                timestamp: new Date()
            }
        }, { priority: 1 });
    }
    async addTrainingJob(modelType, trainingData, configuration, userId) {
        return this.addJob({
            type: 'training',
            data: {
                modelType,
                trainingData,
                configuration,
                userId
            }
        }, { priority: 15 });
    }
    async addCleanupJob(cleanupType, olderThan, dryRun = false) {
        return this.addJob({
            type: 'cleanup',
            data: {
                cleanupType,
                olderThan,
                dryRun
            }
        }, { priority: 1 });
    }
    async addNotificationJob(userId, type, title, message, metadata) {
        return this.addJob({
            type: 'notification',
            data: {
                userId,
                type,
                title,
                message,
                metadata
            }
        }, { priority: 8 });
    }
    async scheduleRecurringJobs() {
        this.logger.log('📅 Scheduling recurring jobs...');
        await this.addCleanupJob('old_chats', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), false);
        await this.addCleanupJob('unused_embeddings', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), false);
        await this.addCleanupJob('temp_files', new Date(Date.now() - 24 * 60 * 60 * 1000), false);
        this.logger.log('✅ Recurring jobs scheduled');
    }
    async getQueueStats() {
        const waiting = await this.queue.getWaiting();
        const active = await this.queue.getActive();
        const completed = await this.queue.getCompleted();
        const failed = await this.queue.getFailed();
        const delayed = await this.queue.getDelayed();
        const paused = await this.queue.isPaused();
        return {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
            paused: paused ? 1 : 0
        };
    }
    async getRecentJobs(limit = 20) {
        const jobs = await this.queue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, limit - 1);
        return jobs;
    }
    async getJob(jobId) {
        return this.queue.getJob(jobId);
    }
    async removeJob(jobId) {
        const job = await this.getJob(jobId);
        if (job) {
            await job.remove();
            this.logger.log(`🗑️ Job ${jobId} removed`);
        }
    }
    async retryJob(jobId) {
        const job = await this.getJob(jobId);
        if (job) {
            await job.retry();
            this.logger.log(`🔄 Job ${jobId} retried`);
        }
    }
    async cleanCompletedJobs(grace = 100) {
        await this.queue.clean(0, grace, 'completed');
        this.logger.log(`🧹 Cleaned completed jobs (keeping ${grace})`);
    }
    async cleanFailedJobs(grace = 50) {
        await this.queue.clean(0, grace, 'failed');
        this.logger.log(`🧹 Cleaned failed jobs (keeping ${grace})`);
    }
    async pauseQueue() {
        await this.queue.pause();
        this.logger.log('⏸️ Queue paused');
    }
    async resumeQueue() {
        await this.queue.resume();
        this.logger.log('▶️ Queue resumed');
    }
    async getQueueHealth() {
        const stats = await this.getQueueStats();
        const issues = [];
        if (stats.failed > 100) {
            issues.push(`Too many failed jobs: ${stats.failed}`);
        }
        if (stats.waiting > 1000) {
            issues.push(`Too many waiting jobs: ${stats.waiting}`);
        }
        if (stats.paused > 0) {
            issues.push('Queue is paused');
        }
        return {
            isHealthy: issues.length === 0,
            stats,
            issues
        };
    }
};
exports.JobQueueService = JobQueueService;
exports.JobQueueService = JobQueueService = JobQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('BULL_QUEUE')),
    __metadata("design:paramtypes", [bullmq_1.Queue])
], JobQueueService);
//# sourceMappingURL=job-queue.service.js.map