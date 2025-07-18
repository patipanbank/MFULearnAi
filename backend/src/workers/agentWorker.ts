import { Worker, Job } from 'bullmq';
import { config } from '../config/config';
import { handleAgentJob } from '../queueHandlers/agentHandler';
import { AgentJobData } from '../services/queueService';

// Redis connection configuration
const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port),
  password: new URL(config.redisUrl).password || undefined,
};

// Create agent worker
export const agentWorker = new Worker(
  'agent',
  async (job: Job<AgentJobData>) => {
    await handleAgentJob(job);
  },
  {
    connection,
    concurrency: 3, // Process up to 3 jobs concurrently
  }
);

// Worker event handlers
agentWorker.on('completed', (job: Job<AgentJobData>) => {
  console.log(`✅ Agent job ${job.id} completed successfully`);
});

agentWorker.on('failed', (job: Job<AgentJobData> | undefined, err: Error) => {
  console.error(`❌ Agent job ${job?.id} failed:`, err);
});

agentWorker.on('error', (err: Error) => {
  console.error('❌ Agent worker error:', err);
});

agentWorker.on('ready', () => {
  console.log('🚀 Agent worker ready to process jobs');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down agent worker gracefully...');
  await agentWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down agent worker gracefully...');
  await agentWorker.close();
  process.exit(0);
});

console.log('🚀 Agent worker started'); 