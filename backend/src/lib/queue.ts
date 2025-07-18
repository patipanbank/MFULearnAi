import { Queue, Worker, QueueScheduler } from 'bullmq';
import { config } from '../config/config';

// Redis connection configuration
const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port),
  password: new URL(config.redisUrl).password || undefined,
};

// Create queues
export const chatQueue = new Queue('chat', { connection });
export const agentQueue = new Queue('agent', { connection });

// Create scheduler for delayed jobs
export const scheduler = new QueueScheduler('chat', { connection });

// Queue configuration
export const queueConfig = {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Initialize queues with configuration
chatQueue.setDefaultJobOptions(queueConfig.defaultJobOptions);
agentQueue.setDefaultJobOptions(queueConfig.defaultJobOptions);

export { Queue, Worker }; 