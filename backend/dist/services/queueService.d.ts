import { IUser } from '../models/user';
interface ProcessingProgress {
    jobId: string;
    userId: string;
    fileName: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    result?: {
        chunksCount: number;
        processingTime: number;
    };
}
export declare class QueueService {
    private fileProcessingQueue;
    private progressMap;
    constructor();
    private setupProcessors;
    private setupEventListeners;
    addFileProcessingJob(fileBuffer: Buffer, fileName: string, user: IUser, modelId: string, collectionName: string): Promise<string>;
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
    shutdown(): Promise<void>;
}
export declare const queueService: QueueService;
export {};
//# sourceMappingURL=queueService.d.ts.map