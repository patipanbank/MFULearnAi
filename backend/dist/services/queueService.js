"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = exports.QueueService = void 0;
const bull_1 = __importDefault(require("bull"));
const trainingService_1 = require("./trainingService");
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
        this.fileProcessingQueue = new bull_1.default('file processing', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                db: 0,
            },
            defaultJobOptions: {
                removeOnComplete: 10,
                removeOnFail: 50,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            },
        });
        this.setupProcessors();
        this.setupEventListeners();
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
    async shutdown() {
        console.log('🛑 Shutting down queue service...');
        await this.fileProcessingQueue.close();
    }
}
exports.QueueService = QueueService;
exports.queueService = new QueueService();
//# sourceMappingURL=queueService.js.map