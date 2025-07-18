import { Worker, Job } from 'bullmq';
import { config } from '../config/config';
import { handleNotificationJob } from '../queueHandlers/notificationHandler';
import { NotificationJobData } from '../services/queueService';

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port),
  password: new URL(config.redisUrl).password || undefined,
};

export const notificationWorker = new Worker(
  'notification',
  async (job: Job<NotificationJobData>) => {
    await handleNotificationJob(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

notificationWorker.on('completed', (job: Job<NotificationJobData>) => {
  console.log(`✅ Notification job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job: Job<NotificationJobData> | undefined, err: Error) => {
  console.error(`❌ Notification job ${job?.id} failed:`, err);
});

notificationWorker.on('error', (err: Error) => {
  console.error('❌ Notification worker error:', err);
});

notificationWorker.on('ready', () => {
  console.log('🚀 Notification worker ready to process jobs');
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down notification worker gracefully...');
  await notificationWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down notification worker gracefully...');
  await notificationWorker.close();
  process.exit(0);
});

console.log('🚀 Notification worker started'); 