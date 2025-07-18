import { Worker, Job } from 'bullmq';
import { config } from '../config/config';
import { handleChatJob } from '../queueHandlers/chatHandler';
import { ChatJobData } from '../services/queueService';
import { connectDB } from '../lib/mongodb';

// Redis connection configuration
const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port),
  password: new URL(config.redisUrl).password || undefined,
};

(async () => {
  await connectDB();
  // Create chat worker
  const chatWorker = new Worker(
    'chat',
    async (job: Job<ChatJobData>) => {
      await handleChatJob(job);
    },
    {
      connection,
      concurrency: 5, // Process up to 5 jobs concurrently
    }
  );

  // Worker event handlers
  chatWorker.on('completed', (job: Job<ChatJobData>) => {
    console.log(`✅ Chat job ${job.id} completed successfully`);
  });

  chatWorker.on('failed', (job: Job<ChatJobData> | undefined, err: Error) => {
    console.error(`❌ Chat job ${job?.id} failed:`, err);
  });

  chatWorker.on('error', (err: Error) => {
    console.error('❌ Chat worker error:', err);
  });

  chatWorker.on('ready', () => {
    console.log('🚀 Chat worker ready to process jobs');
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down chat worker gracefully...');
    await chatWorker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down chat worker gracefully...');
    await chatWorker.close();
    process.exit(0);
  });

  console.log('🚀 Chat worker started');
})(); 