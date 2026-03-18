import { Queue, QueueEvents, Job } from 'bullmq';
import { LoggerService } from './LoggerService';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

const connection = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD
};

// ── DLQ Configuration ───────────────────────────────────────
const DLQ_NAME = 'ocr-dlq';
const DLQ_RETENTION_HOURS = parseInt(process.env.DLQ_RETENTION_HOURS || '168'); // 7 days

class QueueService {
    public ocrQueue: Queue;
    public dlqQueue: Queue;

    constructor() {
        // Main OCR queue
        this.ocrQueue = new Queue('ocr-queue', {
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: 100,
                removeOnFail: false  // Keep failed jobs for DLQ migration
            }
        });

        // Dead Letter Queue — stores permanently failed jobs for inspection/replay
        this.dlqQueue = new Queue(DLQ_NAME, {
            connection,
            defaultJobOptions: {
                removeOnComplete: false,
                removeOnFail: false
            }
        });

        this.ocrQueue.on('error', (err) => {
            LoggerService.error('Queue Error', err);
        });

        this.dlqQueue.on('error', (err) => {
            LoggerService.error('DLQ Error', err);
        });

        // Periodically clean old DLQ entries
        this._scheduleDlqCleanup();
    }

    async addOcrJob(data: any): Promise<string> {
        const job = await this.ocrQueue.add('parse', data);
        return job.id || '';
    }

    /**
     * Move a permanently failed job to the Dead Letter Queue.
     * Called by the worker when all retry attempts are exhausted.
     */
    async moveToDlq(failedJob: Job, reason: string): Promise<string> {
        const dlqData = {
            originalJobId: failedJob.id,
            originalQueue: 'ocr-queue',
            originalData: failedJob.data,
            failedAt: new Date().toISOString(),
            failReason: reason,
            attemptsMade: failedJob.attemptsMade,
            stacktrace: failedJob.stacktrace,
        };

        const dlqJob = await this.dlqQueue.add('dead-letter', dlqData);

        LoggerService.warn('job_moved_to_dlq', {
            originalJobId: failedJob.id,
            dlqJobId: dlqJob.id,
            reason,
            attemptsMade: failedJob.attemptsMade,
            fileName: failedJob.data?.fileName
        });

        // Remove from main queue after DLQ copy
        await failedJob.remove().catch(() => { /* Already cleaned */ });

        return dlqJob.id || '';
    }

    /**
     * Replay a DLQ job — re-add it to the OCR queue with fresh attempts.
     */
    async replayDlqJob(dlqJobId: string): Promise<string | null> {
        const dlqJob = await this.dlqQueue.getJob(dlqJobId);
        if (!dlqJob) return null;

        const originalData = dlqJob.data.originalData;
        const newJobId = await this.addOcrJob(originalData);

        LoggerService.info('dlq_job_replayed', {
            dlqJobId,
            newJobId,
            originalJobId: dlqJob.data.originalJobId
        });

        await dlqJob.remove();
        return newJobId;
    }

    /**
     * Replay ALL DLQ jobs back to the main queue.
     */
    async replayAllDlq(): Promise<{ replayed: number; failed: number }> {
        const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed', 'completed', 'failed']);
        let replayed = 0;
        let failed = 0;

        for (const job of jobs) {
            try {
                await this.replayDlqJob(job.id!);
                replayed++;
            } catch {
                failed++;
            }
        }

        LoggerService.info('dlq_replay_all', { replayed, failed });
        return { replayed, failed };
    }

    /**
     * Get DLQ stats for monitoring dashboard.
     */
    async getDlqStats(): Promise<{
        waiting: number;
        total: number;
        oldest: string | null;
        newest: string | null;
        jobs: Array<{ id: string; fileName: string; failReason: string; failedAt: string }>;
    }> {
        const counts = await this.dlqQueue.getJobCounts('waiting', 'delayed');
        const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed'], 0, 50);

        const summaries = jobs.map(j => ({
            id: j.id || '',
            fileName: j.data?.originalData?.fileName || 'unknown',
            failReason: j.data?.failReason || 'unknown',
            failedAt: j.data?.failedAt || ''
        }));

        return {
            waiting: counts.waiting + counts.delayed,
            total: jobs.length,
            oldest: summaries.length > 0 ? summaries[summaries.length - 1].failedAt : null,
            newest: summaries.length > 0 ? summaries[0].failedAt : null,
            jobs: summaries
        };
    }

    /**
     * Clean DLQ entries older than retention period.
     */
    private _scheduleDlqCleanup(): void {
        const cleanupInterval = 60 * 60 * 1000; // Every hour
        setInterval(async () => {
            try {
                const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed', 'completed']);
                const cutoff = Date.now() - (DLQ_RETENTION_HOURS * 60 * 60 * 1000);
                let cleaned = 0;

                for (const job of jobs) {
                    const failedAt = new Date(job.data?.failedAt || 0).getTime();
                    if (failedAt < cutoff) {
                        await job.remove();
                        cleaned++;
                    }
                }

                if (cleaned > 0) {
                    LoggerService.info('dlq_cleanup', { cleaned, retentionHours: DLQ_RETENTION_HOURS });
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                LoggerService.error('dlq_cleanup_error', { error: message });
            }
        }, cleanupInterval);
    }

    /** Graceful close — drain queues */
    async close(): Promise<void> {
        await Promise.allSettled([
            this.ocrQueue.close(),
            this.dlqQueue.close()
        ]);
    }
}

export const queueService = new QueueService();
export const ocrQueueEvents = new QueueEvents('ocr-queue', { connection });
