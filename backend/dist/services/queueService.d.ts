import { IUser } from '../models/user';
interface ProcessingProgress {
    jobId: string;
    userId: string;
    fileName?: string;
    jobType: 'file_processing' | 'memory_cleanup' | 'maintenance' | 'embedding_sync' | 'analytics';
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    result?: {
        chunksCount?: number;
        processingTime: number;
        itemsProcessed?: number;
        details?: any;
    };
}
export declare class QueueService {
    private fileProcessingQueue;
    private memoryCleanupQueue;
    private maintenanceQueue;
    private embeddingSyncQueue;
    private progressMap;
    constructor();
    private setupProcessors;
    private setupEventListeners;
    addFileProcessingJob(fileBuffer: Buffer, fileName: string, user: IUser, modelId: string, collectionName: string): Promise<string>;
    addMemoryCleanupJob(sessionId: string, cutoffDate: Date): Promise<string>;
    addMaintenanceJob(taskType: 'chat_cleanup' | 'index_optimization' | 'analytics_aggregation' | 'collection_sync', parameters?: any): Promise<string>;
    addEmbeddingSyncJob(collectionName: string, batchSize?: number, startFrom?: string): Promise<string>;
    private updateProgress;
    getJobProgress(jobId: string): ProcessingProgress | null;
    getAllJobsForUser(userId: string): ProcessingProgress[];
    getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        total: number;
    }>;
    cleanupOldJobs(): Promise<void>;
    private processFileWithProgress;
    private performChatCleanup;
    private performIndexOptimization;
    private performAnalyticsAggregation;
    private performCollectionSync;
    private generateChatAnalytics;
    private schedulePeriodicTasks;
    shutdown(): Promise<void>;
}
export declare const queueService: QueueService;
export {};
//# sourceMappingURL=queueService.d.ts.map