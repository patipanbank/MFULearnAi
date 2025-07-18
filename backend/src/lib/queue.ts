import { Queue, Worker } from 'bullmq';
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

// Create queues with configuration
export const chatQueue = new Queue('chat', { 
  connection,
  defaultJobOptions: queueConfig.defaultJobOptions
});
export const agentQueue = new Queue('agent', { 
  connection,
  defaultJobOptions: queueConfig.defaultJobOptions
});

export { Queue, Worker }; 