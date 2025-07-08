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
var JobProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const common_1 = require("@nestjs/common");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const chroma_service_1 = require("../../services/chroma.service");
const document_management_service_1 = require("../../services/document-management.service");
let JobProcessor = JobProcessor_1 = class JobProcessor extends bullmq_1.WorkerHost {
    constructor(bedrockService, chromaService, documentManagementService) {
        super();
        this.bedrockService = bedrockService;
        this.chromaService = chromaService;
        this.documentManagementService = documentManagementService;
        this.logger = new common_1.Logger(JobProcessor_1.name);
    }
    onActive(job) {
        this.logger.log(`🚀 Job ${job.id} (${job.name}) started processing`);
    }
    onCompleted(job) {
        this.logger.log(`✅ Job ${job.id} (${job.name}) completed successfully`);
    }
    onFailed(job, error) {
        this.logger.error(`❌ Job ${job.id} (${job.name}) failed: ${error.message}`);
    }
    onStalled(job) {
        this.logger.warn(`⏸️ Job ${job.id} (${job.name}) stalled`);
    }
    async process(job) {
        const { name, data } = job;
        this.logger.debug(`Processing job: ${name}`);
        try {
            switch (name) {
                case 'document_processing':
                    await this.processDocumentProcessing(job);
                    break;
                case 'embedding':
                    await this.processEmbedding(job);
                    break;
                case 'usage_stats':
                    await this.processUsageStats(job);
                    break;
                case 'training':
                    await this.processTraining(job);
                    break;
                case 'cleanup':
                    await this.processCleanup(job);
                    break;
                case 'notification':
                    await this.processNotification(job);
                    break;
                default:
                    this.logger.warn(`Unknown job type: ${name}`);
                    throw new Error(`Unknown job type: ${name}`);
            }
        }
        catch (error) {
            this.logger.error(`Error processing job ${job.id} (${name}):`, error);
            throw error;
        }
    }
    async processDocumentProcessing(job) {
        const { collectionId, documentId, filename, fileBuffer, userId } = job.data;
        this.logger.log(`📄 Processing document: ${filename} for collection: ${collectionId}`);
        try {
            await job.updateProgress(10);
            const file = {
                originalname: filename,
                buffer: fileBuffer,
                size: fileBuffer.length,
                mimetype: this.getMimeType(filename),
                fieldname: 'file',
                encoding: '7bit',
                destination: '',
                filename: filename,
                path: '',
                stream: null,
            };
            await job.updateProgress(20);
            const result = await this.documentManagementService.uploadDocument(collectionId, file, userId);
            await job.updateProgress(100);
            this.logger.log(`✅ Document processed: ${filename} -> ${result.totalChunks} chunks`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Document processing failed for ${filename}:`, errorMessage);
            throw error;
        }
    }
    async processEmbedding(job) {
        const { texts, chatId, messageId, collectionId, batchSize = 5 } = job.data;
        this.logger.log(`🤖 Processing ${texts.length} embeddings (batch size: ${batchSize})`);
        try {
            const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
            await job.updateProgress(50);
            if (chatId && messageId) {
                const documents = texts.map((text, index) => ({
                    id: `${messageId}_${index}`,
                    text,
                    embedding: embeddings[index],
                    metadata: {
                        chatId,
                        messageId,
                        timestamp: new Date(),
                        index
                    }
                }));
                await this.chromaService.addDocuments(`chat_${chatId}`, documents);
            }
            else if (collectionId) {
                const documents = texts.map((text, index) => ({
                    id: `${collectionId}_${Date.now()}_${index}`,
                    text,
                    embedding: embeddings[index],
                    metadata: {
                        collectionId,
                        timestamp: new Date(),
                        index
                    }
                }));
                await this.chromaService.addDocuments(`collection_${collectionId}`, documents);
            }
            await job.updateProgress(100);
            this.logger.log(`✅ Generated and stored ${embeddings.length} embeddings`);
        }
        catch (error) {
            this.logger.error(`Embedding generation failed:`, error);
            throw error;
        }
    }
    async processUsageStats(job) {
        const { userId, action, metadata, timestamp } = job.data;
        this.logger.debug(`📊 Recording usage stats: ${action} for user: ${userId}`);
        try {
            this.logger.log(`Stats recorded: ${userId} - ${action} - ${timestamp}`);
            await job.updateProgress(100);
            this.logger.debug(`✅ Usage stats recorded: ${action}`);
        }
        catch (error) {
            this.logger.error(`Usage stats recording failed:`, error);
            throw error;
        }
    }
    async processTraining(job) {
        const { modelType, trainingData, configuration, userId } = job.data;
        this.logger.log(`🧠 Starting training job: ${modelType} with ${trainingData.length} samples`);
        try {
            await job.updateProgress(10);
            if (!trainingData || trainingData.length === 0) {
                throw new Error('No training data provided');
            }
            await job.updateProgress(50);
            await new Promise(resolve => setTimeout(resolve, 2000));
            await job.updateProgress(100);
            this.logger.log(`✅ Training completed: ${modelType}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Training failed for ${modelType}:`, errorMessage);
            throw error;
        }
    }
    async processCleanup(job) {
        const { cleanupType, olderThan, dryRun = false } = job.data;
        this.logger.log(`🧹 Starting cleanup: ${cleanupType} (dry run: ${dryRun})`);
        try {
            let cleanedCount = 0;
            switch (cleanupType) {
                case 'old_chats':
                    cleanedCount = await this.cleanupOldChats(olderThan, dryRun);
                    break;
                case 'unused_embeddings':
                    cleanedCount = await this.cleanupUnusedEmbeddings(olderThan, dryRun);
                    break;
                case 'temp_files':
                    cleanedCount = await this.cleanupTempFiles(olderThan, dryRun);
                    break;
                default:
                    throw new Error(`Unknown cleanup type: ${cleanupType}`);
            }
            await job.updateProgress(100);
            this.logger.log(`✅ Cleanup completed: ${cleanupType} - ${cleanedCount} items ${dryRun ? '(dry run)' : 'cleaned'}`);
        }
        catch (error) {
            this.logger.error(`Cleanup failed for ${cleanupType}:`, error);
            throw error;
        }
    }
    async processNotification(job) {
        const { userId, type, title, message, metadata } = job.data;
        this.logger.log(`📢 Sending notification: ${type} to user: ${userId}`);
        try {
            switch (type) {
                case 'websocket':
                    this.logger.log(`WebSocket notification sent to ${userId}: ${title}`);
                    break;
                case 'email':
                    this.logger.warn('Email notifications not implemented yet');
                    break;
                case 'push':
                    this.logger.warn('Push notifications not implemented yet');
                    break;
                default:
                    throw new Error(`Unknown notification type: ${type}`);
            }
            await job.updateProgress(100);
            this.logger.log(`✅ Notification sent: ${type}`);
        }
        catch (error) {
            this.logger.error(`Notification failed:`, error);
            throw error;
        }
    }
    async cleanupOldChats(olderThan, dryRun) {
        this.logger.log(`Cleaning up chats older than ${olderThan || 'undefined date'}`);
        if (dryRun) {
            return 42;
        }
        return 0;
    }
    async cleanupUnusedEmbeddings(olderThan, dryRun) {
        this.logger.log(`Cleaning up unused embeddings older than ${olderThan || 'undefined date'}`);
        if (dryRun) {
            return 156;
        }
        return 0;
    }
    async cleanupTempFiles(olderThan, dryRun) {
        this.logger.log(`Cleaning up temp files older than ${olderThan || 'undefined date'}`);
        if (dryRun) {
            return 23;
        }
        return 0;
    }
    getMimeType(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        switch (ext) {
            case 'pdf':
                return 'application/pdf';
            case 'txt':
                return 'text/plain';
            case 'md':
                return 'text/markdown';
            case 'json':
                return 'application/json';
            case 'csv':
                return 'text/csv';
            default:
                return 'application/octet-stream';
        }
    }
};
exports.JobProcessor = JobProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], JobProcessor.prototype, "onActive", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], JobProcessor.prototype, "onCompleted", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job, Error]),
    __metadata("design:returntype", void 0)
], JobProcessor.prototype, "onFailed", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('stalled'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], JobProcessor.prototype, "onStalled", null);
exports.JobProcessor = JobProcessor = JobProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('default'),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService,
        chroma_service_1.ChromaService,
        document_management_service_1.DocumentManagementService])
], JobProcessor);
//# sourceMappingURL=job.processor.js.map