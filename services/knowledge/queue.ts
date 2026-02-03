import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { processKnowledgeJob } from './worker';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const KNOWLEDGE_QUEUE_NAME = 'knowledge-processing';

export const knowledgeQueue = new Queue(KNOWLEDGE_QUEUE_NAME, { connection });

export const initWorker = () => {
    const worker = new Worker(KNOWLEDGE_QUEUE_NAME, processKnowledgeJob, {
        connection,
        concurrency: 2 // Process 2 files at a time
    });

    worker.on('completed', job => {
        console.log(`[Worker] Job ${job.id} completed!`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err);
    });

    console.log('[Worker] Knowledge Processing Worker started.');
    return worker;
};
