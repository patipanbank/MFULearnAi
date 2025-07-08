import { Queue, Job } from 'bullmq';
export interface DocumentProcessingJob {
    type: 'document_processing';
    data: {
        collectionId: string;
        documentId: string;
        filename: string;
        fileBuffer: Buffer;
        userId: string;
        priority?: number;
    };
}
export interface EmbeddingJob {
    type: 'embedding';
    data: {
        texts: string[];
        chatId?: string;
        messageId?: string;
        collectionId?: string;
        batchSize?: number;
    };
}
export interface UsageStatsJob {
    type: 'usage_stats';
    data: {
        userId: string;
        action: 'chat' | 'document_upload' | 'search' | 'agent_execution';
        metadata?: Record<string, any>;
        timestamp: Date;
    };
}
export interface TrainingJob {
    type: 'training';
    data: {
        modelType: string;
        trainingData: any[];
        configuration: Record<string, any>;
        userId: string;
    };
}
export interface CleanupJob {
    type: 'cleanup';
    data: {
        cleanupType: 'old_chats' | 'unused_embeddings' | 'temp_files';
        olderThan?: Date;
        dryRun?: boolean;
    };
}
export interface NotificationJob {
    type: 'notification';
    data: {
        userId: string;
        type: 'email' | 'websocket' | 'push';
        title: string;
        message: string;
        metadata?: Record<string, any>;
    };
}
export type JobData = DocumentProcessingJob | EmbeddingJob | UsageStatsJob | TrainingJob | CleanupJob | NotificationJob;
export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}
export declare class JobQueueService {
    private readonly queue;
    private readonly logger;
    constructor(queue: Queue);
    addJob(jobData: JobData, options?: {
        priority?: number;
        delay?: number;
        attempts?: number;
        repeat?: any;
    }): Promise<Job>;
    addDocumentProcessingJob(collectionId: string, documentId: string, filename: string, fileBuffer: Buffer, userId: string, priority?: number): Promise<Job>;
    addEmbeddingJob(texts: string[], options?: {
        chatId?: string;
        messageId?: string;
        collectionId?: string;
        batchSize?: number;
        priority?: number;
    }): Promise<Job>;
    addUsageStatsJob(userId: string, action: 'chat' | 'document_upload' | 'search' | 'agent_execution', metadata?: Record<string, any>): Promise<Job>;
    addTrainingJob(modelType: string, trainingData: any[], configuration: Record<string, any>, userId: string): Promise<Job>;
    addCleanupJob(cleanupType: 'old_chats' | 'unused_embeddings' | 'temp_files', olderThan?: Date, dryRun?: boolean): Promise<Job>;
    addNotificationJob(userId: string, type: 'email' | 'websocket' | 'push', title: string, message: string, metadata?: Record<string, any>): Promise<Job>;
    scheduleRecurringJobs(): Promise<void>;
    getQueueStats(): Promise<QueueStats>;
    getRecentJobs(limit?: number): Promise<Job[]>;
    getJob(jobId: string): Promise<Job | null>;
    removeJob(jobId: string): Promise<void>;
    retryJob(jobId: string): Promise<void>;
    cleanCompletedJobs(grace?: number): Promise<void>;
    cleanFailedJobs(grace?: number): Promise<void>;
    pauseQueue(): Promise<void>;
    resumeQueue(): Promise<void>;
    getQueueHealth(): Promise<{
        isHealthy: boolean;
        stats: QueueStats;
        issues: string[];
    }>;
}
