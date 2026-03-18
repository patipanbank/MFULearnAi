import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { processKnowledgeJob } from './worker';
import { Knowledge } from './models';
import { LoggerService } from '../services/LoggerService';
import {
    KNOWLEDGE_QUEUE_NAME,
    WORKER_CONCURRENCY,
    MAX_RETRY_ATTEMPTS,
    RETRY_BACKOFF_MS,
    JOB_TIMEOUT_MS
} from './constants';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// Dead Letter Queue for permanently failed jobs
const DLQ_NAME = `${KNOWLEDGE_QUEUE_NAME}-dlq`;

export { KNOWLEDGE_QUEUE_NAME };

export const knowledgeQueue = new Queue(KNOWLEDGE_QUEUE_NAME, {
    connection: connection as any,
    defaultJobOptions: {
        attempts: MAX_RETRY_ATTEMPTS,
        backoff: {
            type: 'exponential',
            delay: RETRY_BACKOFF_MS, // 30s → 60s → 120s
        },
        removeOnComplete: {
            count: 500,  // Keep last 500 completed jobs for audit
            age: 7 * 24 * 3600, // 7 days
        },
        removeOnFail: {
            count: 200,  // Keep last 200 failed jobs for debugging
            age: 30 * 24 * 3600, // 30 days
        },
    },
});

export const deadLetterQueue = new Queue(DLQ_NAME, { connection: connection as any });

export const initWorker = () => {
    const worker = new Worker(KNOWLEDGE_QUEUE_NAME, processKnowledgeJob, {
        connection: connection as any,
        concurrency: WORKER_CONCURRENCY,
        lockDuration: JOB_TIMEOUT_MS,
        stalledInterval: Math.floor(JOB_TIMEOUT_MS / 2),
        maxStalledCount: 2,
        limiter: {
            max: WORKER_CONCURRENCY * 2,
            duration: 1000, // Rate limit: max N*2 jobs started per second
        },
    });

    worker.on('completed', async (job) => {
        LoggerService.info('worker_job_completed', {
            jobId: job?.id,
            knowledgeId: job?.data?.knowledgeId,
            duration: job?.processedOn && job?.finishedOn
                ? job.finishedOn - job.processedOn
                : undefined,
            attempts: job?.attemptsMade
        });

        // Record processing duration on the Knowledge document
        if (job?.data?.knowledgeId && job?.processedOn && job?.finishedOn) {
            try {
                await Knowledge.findByIdAndUpdate(job.data.knowledgeId, {
                    processingDuration: job.finishedOn - job.processedOn
                });
            } catch (_) { /* best effort */ }
        }
    });

    worker.on('failed', async (job, err) => {
        const isExhausted = job && job.attemptsMade >= (job.opts?.attempts || MAX_RETRY_ATTEMPTS);

        LoggerService.error('worker_job_failed', {
            jobId: job?.id,
            knowledgeId: job?.data?.knowledgeId,
            error: err?.message,
            attempt: job?.attemptsMade,
            maxAttempts: job?.opts?.attempts || MAX_RETRY_ATTEMPTS,
            exhausted: isExhausted
        });

        // Sync MongoDB status
        if (job?.data?.knowledgeId) {
            try {
                const updateData: any = {
                    errorReason: err?.message || 'Job failed (stalled or unrecoverable)',
                    processingStage: 'failed'
                };

                if (isExhausted) {
                    // All retries exhausted → mark as permanently failed
                    updateData.processingStatus = 'failed';

                    // Move to Dead Letter Queue for admin review
                    await deadLetterQueue.add('failed-permanently', {
                        ...job.data,
                        originalJobId: job.id,
                        error: err?.message,
                        attempts: job.attemptsMade,
                        failedAt: new Date().toISOString()
                    });
                    LoggerService.warn('worker_job_moved_to_dlq', {
                        jobId: job.id,
                        knowledgeId: job.data.knowledgeId
                    });
                } else {
                    // Still has retries left — keep processing status
                    updateData.processingStatus = 'processing';
                    updateData.errorReason = `Retry ${job.attemptsMade}/${job.opts?.attempts || MAX_RETRY_ATTEMPTS}: ${err?.message}`;
                }

                await Knowledge.findByIdAndUpdate(job.data.knowledgeId, updateData);

                // Update retry count
                await Knowledge.findByIdAndUpdate(job.data.knowledgeId, {
                    $inc: { processingRetryCount: 1 }
                });

                LoggerService.info('worker_mongodb_status_synced', {
                    knowledgeId: job.data.knowledgeId,
                    status: isExhausted ? 'failed' : 'retrying',
                    attempt: job.attemptsMade
                });
            } catch (dbErr: any) {
                LoggerService.error('worker_mongodb_sync_failed', { error: dbErr.message });
            }
        }
    });

    // Monitor stalled jobs
    worker.on('stalled', (jobId) => {
        LoggerService.warn('worker_job_stalled', { jobId });
    });

    // Queue event monitoring for observability
    const queueEvents = new QueueEvents(KNOWLEDGE_QUEUE_NAME, { connection: connection as any });

    queueEvents.on('waiting', ({ jobId }) => {
        LoggerService.debug('worker_job_queued', { jobId });
    });

    LoggerService.info('worker_started', {
        queue: KNOWLEDGE_QUEUE_NAME,
        concurrency: WORKER_CONCURRENCY,
        maxRetries: MAX_RETRY_ATTEMPTS,
        retryBackoff: RETRY_BACKOFF_MS,
        jobTimeout: JOB_TIMEOUT_MS
    });

    return worker;
};
