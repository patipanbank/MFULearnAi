import { JobQueueService } from './job-queue.service';
export declare class QueueController {
    private readonly jobQueueService;
    constructor(jobQueueService: JobQueueService);
    getQueueStats(): Promise<{
        message: string;
        data: import("./job-queue.service").QueueStats;
    }>;
    getQueueHealth(): Promise<{
        message: string;
        data: {
            isHealthy: boolean;
            stats: import("./job-queue.service").QueueStats;
            issues: string[];
        };
    }>;
    getRecentJobs(limit?: string): Promise<{
        message: string;
        data: {
            id: string | undefined;
            name: string;
            data: any;
            progress: import("bullmq").JobProgress;
            processedOn: number | undefined;
            finishedOn: number | undefined;
            failedReason: string;
            delay: number;
            opts: import("bullmq").JobsOptions;
            timestamp: number;
        }[];
    }>;
    getJob(id: string): Promise<{
        message: string;
        data: null;
    } | {
        message: string;
        data: {
            id: string | undefined;
            name: string;
            data: any;
            progress: import("bullmq").JobProgress;
            processedOn: number | undefined;
            finishedOn: number | undefined;
            failedReason: string;
            delay: number;
            opts: import("bullmq").JobsOptions;
            timestamp: number;
            returnvalue: any;
        };
    }>;
    addDocumentProcessingJob(body: {
        collectionId: string;
        documentId: string;
        filename: string;
        fileBuffer: string;
        userId: string;
        priority?: number;
    }): Promise<{
        message: string;
        data: {
            id: string | undefined;
            name: string;
            priority: number | undefined;
        };
    }>;
    addUsageStatsJob(body: {
        userId: string;
        action: 'chat' | 'document_upload' | 'search' | 'agent_execution';
        metadata?: Record<string, any>;
    }): Promise<{
        message: string;
        data: {
            id: string | undefined;
            name: string;
        };
    }>;
    addTrainingJob(body: {
        modelType: string;
        trainingData: any[];
        configuration: Record<string, any>;
        userId: string;
    }): Promise<{
        message: string;
        data: {
            id: string | undefined;
            name: string;
        };
    }>;
    addCleanupJob(body: {
        cleanupType: 'old_chats' | 'unused_embeddings' | 'temp_files';
        olderThan?: string;
        dryRun?: boolean;
    }): Promise<{
        message: string;
        data: {
            id: string | undefined;
            name: string;
        };
    }>;
    scheduleRecurringJobs(req: any): Promise<{
        message: string;
    }>;
    retryJob(id: string): Promise<{
        message: string;
    }>;
    removeJob(id: string): Promise<{
        message: string;
    }>;
    cleanCompletedJobs(body: {
        grace?: number;
    }): Promise<{
        message: string;
    }>;
    cleanFailedJobs(body: {
        grace?: number;
    }): Promise<{
        message: string;
    }>;
    pauseQueue(): Promise<{
        message: string;
    }>;
    resumeQueue(): Promise<{
        message: string;
    }>;
}
