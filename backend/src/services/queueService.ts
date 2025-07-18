import { Job } from 'bullmq';
import { chatQueue, agentQueue, notificationQueue } from '../lib/queue';
import { chatService } from './chatService';
import { langchainChatService } from './langchainChatService';
import { ChatModel } from '../models/chat';
import { bedrockService } from './bedrockService';
import { handleChatJob } from '../queueHandlers/chatHandler';
import { handleAgentJob } from '../queueHandlers/agentHandler';
import { handleNotificationJob } from '../queueHandlers/notificationHandler';

export interface ChatJobData {
  sessionId: string;
  userId: string;
  message: string;
  modelId: string;
  collectionNames: string[];
  images?: any[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  agentId?: string;
}

export interface AgentJobData {
  agentId: string;
  userId: string;
  data: any;
}

export interface NotificationJobData {
  userId: string;
  type: string;
  payload: any;
}

export class QueueService {
  // Add chat job to queue
  async addChatJob(data: ChatJobData) {
    const job = await chatQueue.add('generate-answer', data, {
      jobId: `chat-${data.sessionId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return job;
  }

  // Add agent job to queue
  async addAgentJob(data: AgentJobData) {
    const job = await agentQueue.add('process-agent', data, {
      jobId: `agent-${data.agentId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return job;
  }

  // Add notification job to queue
  async addNotificationJob(data: NotificationJobData) {
    const job = await notificationQueue.add('send-notification', data, {
      jobId: `notification-${data.userId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return job;
  }

  // Process chat job
  async processChatJob(job: Job<ChatJobData>) {
    await handleChatJob(job);
  }

  // Process agent job
  async processAgentJob(job: Job<AgentJobData>) {
    await handleAgentJob(job);
  }

  // Process notification job (เตรียมจุดสำหรับ handler จริง)
  async processNotificationJob(job: Job<NotificationJobData>) {
    await handleNotificationJob(job);
  }

  // Helper method to publish to Redis
  private async publishToRedis(channel: string, message: any) {
    try {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379/0' });
      await client.connect();
      await client.publish(channel, JSON.stringify(message));
      await client.disconnect();
      console.log(`📤 Published to Redis: ${channel}`);
    } catch (error) {
      console.error(`❌ Redis publish error: ${error}`);
    }
  }

  // Get job status
  async getJobStatus(jobId: string) {
    const chatJob = await chatQueue.getJob(jobId);
    const agentJob = await agentQueue.getJob(jobId);
    
    const job = chatJob || agentJob;
    if (!job) {
      return null;
    }
    
    return {
      id: job.id,
      name: job.name,
      state: await job.getState(),
      progress: job.progress,
      data: job.data,
      failedReason: job.failedReason,
    };
  }

  // Get queue statistics
  async getQueueStats() {
    const chatStats = await chatQueue.getJobCounts();
    const agentStats = await agentQueue.getJobCounts();
    
    return {
      chat: chatStats,
      agent: agentStats,
    };
  }
}

export const queueService = new QueueService(); 