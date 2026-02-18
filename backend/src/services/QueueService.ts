import { Queue } from 'bullmq';
import { LoggerService } from './LoggerService';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

const connection = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD
};

class QueueService {
    public ocrQueue: Queue;

    constructor() {
        this.ocrQueue = new Queue('ocr-queue', {
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: 100,
                removeOnFail: 500
            }
        });

        this.ocrQueue.on('error', (err) => {
            LoggerService.error('Queue Error', err);
        });
    }

    async addOcrJob(data: any): Promise<string> {
        const job = await this.ocrQueue.add('parse', data);
        return job.id || '';
    }
}

import { QueueEvents } from 'bullmq';
export const queueService = new QueueService();
export const ocrQueueEvents = new QueueEvents('ocr-queue', { connection });
