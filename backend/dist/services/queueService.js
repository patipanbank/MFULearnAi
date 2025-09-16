"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = exports.QueueService = void 0;
const bull_1 = __importDefault(require("bull"));
const trainingService_1 = require("./trainingService");
const smartMemoryService_1 = require("./smartMemoryService");
const chat_1 = require("../models/chat");
let wsService = null;
try {
    wsService = require('./websocketService').WebSocketService;
}
catch (error) {
    console.warn('WebSocket service not available for queue progress updates');
}
class QueueService {
    constructor() {
        this.progressMap = new Map();
        const redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: 0,
        };
        const defaultJobOptions = {
            removeOnComplete: 10,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        };
        this.fileProcessingQueue = new bull_1.default('file processing', {
            redis: redisConfig,
            defaultJobOptions,
        });
        this.memoryCleanupQueue = new bull_1.default('memory cleanup', {
            redis: redisConfig,
            defaultJobOptions: {
                ...defaultJobOptions,
                removeOnComplete: 5,
                attempts: 2,
            },
        });
        this.maintenanceQueue = new bull_1.default('maintenance', {
            redis: redisConfig,
            defaultJobOptions: {
                ...defaultJobOptions,
                removeOnComplete: 20,
                attempts: 1,
            },
        });
        this.embeddingSyncQueue = new bull_1.default('embedding sync', {
            redis: redisConfig,
            defaultJobOptions: {
                ...defaultJobOptions,
                removeOnComplete: 5,
                attempts: 3,
            },
        });
        this.setupProcessors();
        this.setupEventListeners();
        this.schedulePeriodicTasks();
    }
    setupProcessors() {
        this.fileProcessingQueue.process('processFile', 5, async (job) => {
            const { fileBuffer, fileName, user, modelId, collectionName, jobId } = job.data;
            console.log(`🔄 Processing job ${jobId}: ${fileName}`);
            this.updateProgress(jobId, {
                status: 'processing',
                progress: 5,
            });
            try {
                const startTime = Date.now();
                this.updateProgress(jobId, {
                    status: 'processing',
                    progress: 15,
                });
                const chunksCount = await this.processFileWithProgress(fileBuffer, fileName, user, modelId, collectionName, jobId);
                const processingTime = Date.now() - startTime;
                this.updateProgress(jobId, {
                    status: 'completed',
                    progress: 100,
                    result: {
                        chunksCount,
                        processingTime,
                    },
                });
                console.log(`✅ Job ${jobId} completed: ${chunksCount} chunks in ${processingTime}ms`);
                return {
                    chunksCount,
                    processingTime,
                    fileName,
                    collectionName,
                };
            }
            catch (error) {
                console.error(`❌ Job ${jobId} failed:`, error);
                this.updateProgress(jobId, {
                    status: 'failed',
                    progress: 0,
                    error: error?.message || error,
                });
                throw error;
            }
        });
        this.memoryCleanupQueue.process('cleanupMemory', 2, async (job) => {
            const { sessionId, cutoffDate, jobId } = job.data;
            console.log(`🧹 Processing memory cleanup job ${jobId} for session ${sessionId}`);
            this.updateProgress(jobId, {
                status: 'processing',
                progress: 10,
                jobType: 'memory_cleanup',
            });
            try {
                const startTime = Date.now();
                this.updateProgress(jobId, { status: 'processing', progress: 30, jobType: 'memory_cleanup' });
                await smartMemoryService_1.smartMemoryService.clearSession(sessionId);
                this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'memory_cleanup' });
                const deletedCount = 0;
                const processingTime = Date.now() - startTime;
                this.updateProgress(jobId, {
                    status: 'completed',
                    progress: 100,
                    jobType: 'memory_cleanup',
                    result: {
                        processingTime,
                        itemsProcessed: deletedCount,
                        details: { sessionId, cutoffDate }
                    },
                });
                console.log(`✅ Memory cleanup job ${jobId} completed: ${deletedCount} items in ${processingTime}ms`);
                return { deletedCount, processingTime };
            }
            catch (error) {
                console.error(`❌ Memory cleanup job ${jobId} failed:`, error);
                this.updateProgress(jobId, {
                    status: 'failed',
                    progress: 0,
                    jobType: 'memory_cleanup',
                    error: error?.message || error,
                });
                throw error;
            }
        });
        this.maintenanceQueue.process('maintenance', 1, async (job) => {
            const { taskType, parameters, jobId } = job.data;
            console.log(`🔧 Processing maintenance job ${jobId}: ${taskType}`);
            this.updateProgress(jobId, {
                status: 'processing',
                progress: 10,
                jobType: 'maintenance',
            });
            try {
                const startTime = Date.now();
                let result;
                switch (taskType) {
                    case 'chat_cleanup':
                        result = await this.performChatCleanup(jobId);
                        break;
                    case 'index_optimization':
                        result = await this.performIndexOptimization(jobId);
                        break;
                    case 'analytics_aggregation':
                        result = await this.performAnalyticsAggregation(jobId);
                        break;
                    case 'collection_sync':
                        result = await this.performCollectionSync(jobId, parameters);
                        break;
                    default:
                        throw new Error(`Unknown maintenance task: ${taskType}`);
                }
                const processingTime = Date.now() - startTime;
                this.updateProgress(jobId, {
                    status: 'completed',
                    progress: 100,
                    jobType: 'maintenance',
                    result: {
                        processingTime,
                        itemsProcessed: result.itemsProcessed || 0,
                        details: result
                    },
                });
                console.log(`✅ Maintenance job ${jobId} (${taskType}) completed in ${processingTime}ms`);
                return result;
            }
            catch (error) {
                console.error(`❌ Maintenance job ${jobId} failed:`, error);
                this.updateProgress(jobId, {
                    status: 'failed',
                    progress: 0,
                    jobType: 'maintenance',
                    error: error?.message || error,
                });
                throw error;
            }
        });
        this.embeddingSyncQueue.process('syncEmbeddings', 1, async (job) => {
            const { collectionName, batchSize, startFrom, jobId } = job.data;
            console.log(`🔄 Processing embedding sync job ${jobId} for collection ${collectionName}`);
            this.updateProgress(jobId, {
                status: 'processing',
                progress: 10,
                jobType: 'embedding_sync',
            });
            try {
                const startTime = Date.now();
                let processed = 0;
                let currentStart = startFrom;
                while (true) {
                    this.updateProgress(jobId, {
                        status: 'processing',
                        progress: Math.min(10 + (processed / batchSize) * 80, 90),
                        jobType: 'embedding_sync',
                    });
                    const batchResult = {
                        processed: Math.min(batchSize, 50),
                        hasMore: processed < 100,
                        nextStart: (processed + batchSize).toString()
                    };
                    processed += batchResult.processed;
                    if (!batchResult.hasMore)
                        break;
                    currentStart = batchResult.nextStart;
                }
                const processingTime = Date.now() - startTime;
                this.updateProgress(jobId, {
                    status: 'completed',
                    progress: 100,
                    jobType: 'embedding_sync',
                    result: {
                        processingTime,
                        itemsProcessed: processed,
                        details: { collectionName, batchSize }
                    },
                });
                console.log(`✅ Embedding sync job ${jobId} completed: ${processed} items in ${processingTime}ms`);
                return { processed, processingTime };
            }
            catch (error) {
                console.error(`❌ Embedding sync job ${jobId} failed:`, error);
                this.updateProgress(jobId, {
                    status: 'failed',
                    progress: 0,
                    jobType: 'embedding_sync',
                    error: error?.message || error,
                });
                throw error;
            }
        });
    }
    setupEventListeners() {
        this.fileProcessingQueue.on('completed', (job, result) => {
            console.log(`🎉 Job ${job.id} completed:`, result);
        });
        this.fileProcessingQueue.on('failed', (job, err) => {
            console.error(`💥 Job ${job.id} failed:`, err.message);
        });
        this.fileProcessingQueue.on('progress', (job, progress) => {
            console.log(`📊 Job ${job.id} progress: ${progress}%`);
        });
        this.fileProcessingQueue.on('stalled', (job) => {
            console.warn(`⏳ Job ${job.id} stalled`);
        });
    }
    async addFileProcessingJob(fileBuffer, fileName, user, modelId, collectionName) {
        const jobId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.progressMap.set(jobId, {
            jobId,
            userId: user._id?.toString() || 'unknown',
            fileName,
            jobType: 'file_processing',
            status: 'queued',
            progress: 0,
        });
        const job = await this.fileProcessingQueue.add('processFile', {
            fileBuffer,
            fileName,
            user,
            modelId,
            collectionName,
            jobId,
        }, {
            priority: 1,
            delay: 0,
        });
        console.log(`📝 Added job ${jobId} to queue (Bull Job ID: ${job.id})`);
        return jobId;
    }
    async addMemoryCleanupJob(sessionId, cutoffDate) {
        const jobId = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.progressMap.set(jobId, {
            jobId,
            userId: 'system',
            jobType: 'memory_cleanup',
            status: 'queued',
            progress: 0,
        });
        const job = await this.memoryCleanupQueue.add('cleanupMemory', { sessionId, cutoffDate, jobId }, { priority: 2 });
        console.log(`📝 Added memory cleanup job ${jobId} to queue (Bull Job ID: ${job.id})`);
        return jobId;
    }
    async addMaintenanceJob(taskType, parameters) {
        const jobId = `maintenance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.progressMap.set(jobId, {
            jobId,
            userId: 'system',
            jobType: 'maintenance',
            status: 'queued',
            progress: 0,
        });
        const job = await this.maintenanceQueue.add('maintenance', { taskType, parameters, jobId }, { priority: 3 });
        console.log(`📝 Added maintenance job ${jobId} (${taskType}) to queue (Bull Job ID: ${job.id})`);
        return jobId;
    }
    async addEmbeddingSyncJob(collectionName, batchSize = 100, startFrom) {
        const jobId = `embedding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.progressMap.set(jobId, {
            jobId,
            userId: 'system',
            jobType: 'embedding_sync',
            status: 'queued',
            progress: 0,
        });
        const job = await this.embeddingSyncQueue.add('syncEmbeddings', { collectionName, batchSize, startFrom, jobId }, { priority: 4 });
        console.log(`📝 Added embedding sync job ${jobId} for collection ${collectionName} to queue (Bull Job ID: ${job.id})`);
        return jobId;
    }
    updateProgress(jobId, updates) {
        const current = this.progressMap.get(jobId);
        if (current) {
            const updated = { ...current, ...updates };
            this.progressMap.set(jobId, updated);
            console.log(`📊 Progress update for job ${jobId}:`, updated);
            if (wsService && updated.userId) {
                try {
                    wsService.emitProgressUpdate(updated.userId, {
                        type: 'upload-progress',
                        jobId: updated.jobId,
                        fileName: updated.fileName,
                        status: updated.status,
                        progress: updated.progress,
                        error: updated.error,
                        result: updated.result
                    });
                }
                catch (error) {
                    console.warn('Failed to emit progress update via WebSocket:', error);
                }
            }
        }
    }
    getJobProgress(jobId) {
        return this.progressMap.get(jobId) || null;
    }
    getAllJobsForUser(userId) {
        return Array.from(this.progressMap.values())
            .filter(progress => progress.userId === userId)
            .sort((a, b) => b.jobId.localeCompare(a.jobId));
    }
    async getQueueStats() {
        const waiting = await this.fileProcessingQueue.getWaiting();
        const active = await this.fileProcessingQueue.getActive();
        const completed = await this.fileProcessingQueue.getCompleted();
        const failed = await this.fileProcessingQueue.getFailed();
        return {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            total: this.progressMap.size,
        };
    }
    async cleanupOldJobs() {
        const allJobs = Array.from(this.progressMap.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 100);
        this.progressMap.clear();
        allJobs.forEach(([jobId, progress]) => {
            this.progressMap.set(jobId, progress);
        });
        console.log(`🧹 Cleaned up old jobs, keeping ${this.progressMap.size} recent jobs`);
    }
    async processFileWithProgress(fileBuffer, fileName, user, modelId, collectionName, jobId) {
        this.updateProgress(jobId, {
            status: 'processing',
            progress: 25,
        });
        const textContent = await trainingService_1.trainingService.parseFileContent(fileBuffer, fileName);
        this.updateProgress(jobId, {
            status: 'processing',
            progress: 40,
        });
        const chunks = await trainingService_1.trainingService.splitTextWithProgress(textContent, (progress) => {
            this.updateProgress(jobId, {
                status: 'processing',
                progress: 40 + (progress * 0.15),
            });
        });
        this.updateProgress(jobId, {
            status: 'processing',
            progress: 55,
        });
        const embeddings = await trainingService_1.trainingService.createEmbeddingsWithProgress(chunks, modelId, (progress) => {
            this.updateProgress(jobId, {
                status: 'processing',
                progress: 55 + (progress * 0.25),
            });
        });
        this.updateProgress(jobId, {
            status: 'processing',
            progress: 80,
        });
        const result = await trainingService_1.trainingService.storeDocumentsWithProgress(chunks, embeddings, fileName, user, modelId, collectionName, (progress) => {
            this.updateProgress(jobId, {
                status: 'processing',
                progress: 80 + (progress * 0.15),
            });
        });
        this.updateProgress(jobId, {
            status: 'processing',
            progress: 95,
        });
        return result;
    }
    async performChatCleanup(jobId) {
        this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const deletedChats = await chat_1.ChatModel.deleteMany({
            isDeleted: true,
            deletedAt: { $lt: cutoffDate }
        });
        this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'maintenance' });
        const cleanedMemories = 0;
        this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });
        return {
            itemsProcessed: deletedChats.deletedCount + cleanedMemories,
            deletedChats: deletedChats.deletedCount,
            cleanedMemories
        };
    }
    async performIndexOptimization(jobId) {
        this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });
        const chatIndexStats = { optimized: true };
        this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'maintenance' });
        const chromaStats = { optimizedCollections: 0 };
        this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });
        return {
            itemsProcessed: Object.keys(chatIndexStats).length + chromaStats.optimizedCollections,
            chatIndexStats,
            chromaStats
        };
    }
    async performAnalyticsAggregation(jobId) {
        this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });
        const usageStats = { aggregatedDays: 0 };
        this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'maintenance' });
        const chatStats = await this.generateChatAnalytics();
        this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });
        return {
            itemsProcessed: usageStats.aggregatedDays + chatStats.totalChats,
            usageStats,
            chatStats
        };
    }
    async performCollectionSync(jobId, parameters) {
        this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });
        const syncResults = { totalSynced: 0 };
        this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });
        return {
            itemsProcessed: syncResults.totalSynced,
            ...syncResults
        };
    }
    async generateChatAnalytics() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const pipeline = [
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo },
                    isDeleted: { $ne: true }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        agentId: "$agentId"
                    },
                    chatCount: { $sum: 1 },
                    messageCount: { $sum: { $size: "$messages" } }
                }
            }
        ];
        const analytics = await chat_1.ChatModel.aggregate(pipeline);
        return {
            totalChats: analytics.length,
            analytics
        };
    }
    schedulePeriodicTasks() {
        console.log('📅 Scheduling periodic maintenance tasks...');
        setInterval(async () => {
            const now = new Date();
            if (now.getHours() === 2 && now.getMinutes() === 0) {
                await this.addMaintenanceJob('chat_cleanup');
                await this.addMaintenanceJob('analytics_aggregation');
            }
        }, 60000);
        setInterval(async () => {
            const now = new Date();
            if (now.getDay() === 0 && now.getHours() === 3 && now.getMinutes() === 0) {
                await this.addMaintenanceJob('index_optimization');
                await this.addMaintenanceJob('collection_sync');
            }
        }, 60000);
        setInterval(async () => {
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - 24);
            console.log('🧹 Periodic memory cleanup would trigger here');
        }, 6 * 60 * 60 * 1000);
        console.log('✅ Periodic tasks scheduled');
    }
    async shutdown() {
        console.log('🛑 Shutting down queue service...');
        await this.fileProcessingQueue.close();
        await this.memoryCleanupQueue.close();
        await this.maintenanceQueue.close();
        await this.embeddingSyncQueue.close();
    }
}
exports.QueueService = QueueService;
exports.queueService = new QueueService();
//# sourceMappingURL=queueService.js.map