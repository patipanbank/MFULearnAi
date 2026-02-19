import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { processKnowledgeJob } from './worker';
import { Knowledge } from './models';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const KNOWLEDGE_QUEUE_NAME = 'knowledge-processing';

export const knowledgeQueue = new Queue(KNOWLEDGE_QUEUE_NAME, { connection: connection as any });

export const initWorker = () => {
    const worker = new Worker(KNOWLEDGE_QUEUE_NAME, processKnowledgeJob, {
        connection: connection as any,
        concurrency: 2, // Process 2 files at a time
        lockDuration: 600_000,    // 10 minutes — large PDFs with OCR + embedding take significant time
        stalledInterval: 300_000, // 5 minutes — check for stalled jobs less frequently
        maxStalledCount: 2        // Allow up to 2 stall recoveries before marking as failed
    });

    worker.on('completed', (job: any) => {
        console.log(`[Worker] Job ${job.id} completed!`);
    });

    worker.on('failed', async (job: any, err: any) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err);
        // Sync MongoDB status — critical for stalled jobs where worker.ts catch block doesn't run
        if (job?.data?.knowledgeId) {
            try {
                await Knowledge.findByIdAndUpdate(job.data.knowledgeId, {
                    processingStatus: 'failed',
                    errorReason: err?.message || 'Job failed (stalled or unrecoverable)',
                    processingStage: 'completed'
                });
                console.log(`[Worker] MongoDB status synced to 'failed' for ${job.data.knowledgeId}`);
            } catch (dbErr: any) {
                console.error(`[Worker] Failed to sync MongoDB status:`, dbErr.message);
            }
        }
    });

    console.log('[Worker] Knowledge Processing Worker started.');
    return worker;
};
