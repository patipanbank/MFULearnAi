import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

export interface ChatTaskPayload {
  session_id: string;
  user_id: string;
  message: string;
  model_id: string;
  collection_names: string[];
  images?: any[];
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  agent_id?: string;
}

@Injectable()
export class TaskQueueService {
  private readonly logger = new Logger(TaskQueueService.name);
  private chatQueue: Queue;
  private chatWorker: Worker;
  private redisConnection: Redis;
  private redisPublisher: Redis;

  constructor() {
    this.initializeQueue();
  }

  private async initializeQueue() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      // Simple Redis connections
      this.redisConnection = new Redis(redisUrl);
      this.redisPublisher = new Redis(redisUrl);

      // Create BullMQ Queue (equivalent to Celery queue)
      this.chatQueue = new Queue('chat-processing', {
        connection: this.redisConnection,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      // Create Worker (equivalent to Celery worker)
      this.chatWorker = new Worker(
        'chat-processing',
        async (job: Job<ChatTaskPayload>) => {
          return this.processGenerateAnswerTask(job);
        },
        {
          connection: this.redisConnection,
          concurrency: 5, // Process 5 concurrent tasks
        }
      );

      // Worker event handlers
      this.chatWorker.on('completed', (job) => {
        this.logger.log(`✅ Job ${job.id} completed for session ${job.data.session_id}`);
      });

      this.chatWorker.on('failed', (job, err) => {
        this.logger.error(`❌ Job ${job?.id} failed for session ${job?.data.session_id}: ${err.message}`);
      });

      this.logger.log('🚀 Task Queue Service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Task Queue Service:', error);
    }
  }

  /**
   * Add task to queue (equivalent to generate_answer.delay() in FastAPI)
   */
  async addGenerateAnswerTask(payload: ChatTaskPayload): Promise<Job<ChatTaskPayload>> {
    this.logger.log(`📋 Adding generate answer task for session ${payload.session_id}`);
    
    const job = await this.chatQueue.add('generate-answer', payload, {
      priority: 1,
      delay: 0,
      jobId: `chat-${payload.session_id}-${Date.now()}`,
    });

    this.logger.log(`🚀 Task ${job.id} queued for session ${payload.session_id}`);
    return job;
  }

  /**
   * Process generate answer task (equivalent to generate_answer() Celery task)
   */
  private async processGenerateAnswerTask(job: Job<ChatTaskPayload>): Promise<void> {
    const { session_id, user_id, message, model_id, collection_names, agent_id } = job.data;
    
    this.logger.log(`🎯 Processing generate answer task for session ${session_id}`);
    this.logger.log(`📝 Message: ${message}`);
    this.logger.log(`🤖 Agent ID: ${agent_id || 'No agent'}`);
    this.logger.log(`🔧 Model ID: ${model_id}`);

    try {
      // Use actual LangChain Chat Service (like FastAPI)
      const { LangChainChatService } = await import('../langchain/langchain-chat.service');
      const langchainService = new LangChainChatService();

      // Create chat request
      const chatRequest = {
        sessionId: session_id,
        userId: user_id,
        message,
        modelId: model_id,
        collectionNames: collection_names || [],
        agentId: agent_id,
        systemPrompt: job.data.system_prompt,
        temperature: job.data.temperature || 0.7,
        maxTokens: job.data.max_tokens || 4000,
        images: job.data.images || [],
      };

      // Process chat using LangChain streaming generator (like FastAPI)
      const chatGenerator = langchainService.chat(chatRequest);

      // Process streaming chunks and publish to Redis (like FastAPI)
      for await (const chunk of chatGenerator) {
        try {
          const data = JSON.parse(chunk);
          
          // Forward all events to Redis for WebSocket streaming
          await this.publishToRedis(`chat:${session_id}`, data);
          
          this.logger.debug(`📤 Published ${data.type} to Redis: chat:${session_id}`);
        } catch (parseError) {
          this.logger.warn(`⚠️ Failed to parse chunk: ${parseError.message}`);
          continue;
        }
      }
      
      this.logger.log(`✅ Successfully processed task for session ${session_id}`);
      
    } catch (error) {
      this.logger.error(`❌ Task processing failed for session ${session_id}: ${error.message}`);
      
      // Send error to client via Redis
      await this.publishToRedis(`chat:${session_id}`, {
        type: 'error',
        data: `An unexpected error occurred: ${error.message}`
      });
      
      throw error;
    }
  }



  /**
   * Publish message to Redis channel (for WebSocket streaming)
   */
  private async publishToRedis(channel: string, data: any): Promise<void> {
    try {
      const message = JSON.stringify(data);
      await this.redisPublisher.publish(channel, message);
      this.logger.debug(`📤 Published to Redis: ${channel}`);
    } catch (error) {
      this.logger.error(`❌ Redis publish error: ${error.message}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const waiting = await this.chatQueue.getWaiting();
      const active = await this.chatQueue.getActive();
      const completed = await this.chatQueue.getCompleted();
      const failed = await this.chatQueue.getFailed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length,
      };
    } catch (error) {
      this.logger.error('Error getting queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }
  }

  /**
   * Clean up resources
   */
  async onDestroy() {
    await this.chatQueue?.close();
    await this.chatWorker?.close();
    await this.redisConnection?.disconnect();
    await this.redisPublisher?.disconnect();
  }
} 