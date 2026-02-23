import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { processKnowledgeJob } from './worker';
import { Knowledge } from './models';
import { LoggerService } from '../services/LoggerService';
import { KNOWLEDGE_QUEUE_NAME } from './constants';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export { KNOWLEDGE_QUEUE_NAME };

export const knowledgeQueue = new Queue(KNOWLEDGE_QUEUE_NAME, { connection: connection as any });

export const initWorker = () => {
    const worker = new Worker(KNOWLEDGE_QUEUE_NAME, processKnowledgeJob, {
        connection: connection as any,
        concurrency: 2, // Process 2 files at a time
        lockDuration: 600_000,    // 10 minutes — large PDFs with OCR + embedding take significant time
        stalledInterval: 300_000, // 5 minutes — check for stalled jobs less frequently
        maxStalledCount: 2        // Allow up to 2 stall recoveries before marking as failed
    });

    worker.on('completed', (job) => {
        LoggerService.info('worker_job_completed', { jobId: job?.id });
    });

    worker.on('failed', async (job, err) => {
        LoggerService.error('worker_job_failed', { jobId: job?.id, error: err?.message });
        // Sync MongoDB status — critical for stalled jobs where worker.ts catch block doesn't run
        if (job?.data?.knowledgeId) {
            try {
                await Knowledge.findByIdAndUpdate(job.data.knowledgeId, {
                    processingStatus: 'failed',
                    errorReason: err?.message || 'Job failed (stalled or unrecoverable)',
                    processingStage: 'failed'
                });
                LoggerService.info('worker_mongodb_status_synced', { knowledgeId: job.data.knowledgeId, status: 'failed' });
            } catch (dbErr: any) {
                LoggerService.error('worker_mongodb_sync_failed', { error: dbErr.message });
            }
        }
    });

    LoggerService.info('worker_started', { queue: KNOWLEDGE_QUEUE_NAME });
    return worker;
};
