import { Injectable, Logger, Inject } from '@nestjs/common';
import { Queue, Job } from 'bullmq';

export interface DocumentProcessingJob {
  type: 'document_processing';
  data: {
    collectionId: string;
    documentId: string;
    filename: string;
    fileBuffer: Buffer;
    userId: string;
    priority?: number;
  };
}

export interface EmbeddingJob {
  type: 'embedding';
  data: {
    texts: string[];
    chatId?: string;
    messageId?: string;
    collectionId?: string;
    batchSize?: number;
  };
}

export interface UsageStatsJob {
  type: 'usage_stats';
  data: {
    userId: string;
    action: 'chat' | 'document_upload' | 'search' | 'agent_execution';
    metadata?: Record<string, any>;
    timestamp: Date;
  };
}

export interface TrainingJob {
  type: 'training';
  data: {
    modelType: string;
    trainingData: any[];
    configuration: Record<string, any>;
    userId: string;
  };
}

export interface CleanupJob {
  type: 'cleanup';
  data: {
    cleanupType: 'old_chats' | 'unused_embeddings' | 'temp_files';
    olderThan?: Date;
    dryRun?: boolean;
  };
}

export interface NotificationJob {
  type: 'notification';
  data: {
    userId: string;
    type: 'email' | 'websocket' | 'push';
    title: string;
    message: string;
    metadata?: Record<string, any>;
  };
}

export type JobData = DocumentProcessingJob | EmbeddingJob | UsageStatsJob | TrainingJob | CleanupJob | NotificationJob;

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @Inject('BULL_QUEUE') private readonly queue: Queue,
  ) {}

  /**
   * Add a job to the queue
   */
  async addJob(jobData: JobData, options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    repeat?: any;
  }): Promise<Job> {
    const defaultOptions = {
      priority: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    };

    const jobOptions = { ...defaultOptions, ...options };
    
    this.logger.log(`📋 Adding job: ${jobData.type} with priority ${jobOptions.priority}`);

    const job = await this.queue.add(
      jobData.type,
      jobData.data,
      jobOptions
    );

    return job;
  }

  /**
   * Add high priority document processing job
   */
  async addDocumentProcessingJob(
    collectionId: string,
    documentId: string,
    filename: string,
    fileBuffer: Buffer,
    userId: string,
    priority: number = 10
  ): Promise<Job> {
    return this.addJob({
      type: 'document_processing',
      data: {
        collectionId,
        documentId,
        filename,
        fileBuffer,
        userId,
        priority
      }
    }, { priority });
  }

  /**
   * Add embedding generation job
   */
  async addEmbeddingJob(
    texts: string[],
    options?: {
      chatId?: string;
      messageId?: string;
      collectionId?: string;
      batchSize?: number;
      priority?: number;
    }
  ): Promise<Job> {
    return this.addJob({
      type: 'embedding',
      data: {
        texts,
        chatId: options?.chatId,
        messageId: options?.messageId,
        collectionId: options?.collectionId,
        batchSize: options?.batchSize || 5
      }
    }, { priority: options?.priority || 5 });
  }

  /**
   * Add usage statistics job
   */
  async addUsageStatsJob(
    userId: string,
    action: 'chat' | 'document_upload' | 'search' | 'agent_execution',
    metadata?: Record<string, any>
  ): Promise<Job> {
    return this.addJob({
      type: 'usage_stats',
      data: {
        userId,
        action,
        metadata,
        timestamp: new Date()
      }
    }, { priority: 1 });
  }

  /**
   * Add training job
   */
  async addTrainingJob(
    modelType: string,
    trainingData: any[],
    configuration: Record<string, any>,
    userId: string
  ): Promise<Job> {
    return this.addJob({
      type: 'training',
      data: {
        modelType,
        trainingData,
        configuration,
        userId
      }
    }, { priority: 15 });
  }

  /**
   * Add cleanup job
   */
  async addCleanupJob(
    cleanupType: 'old_chats' | 'unused_embeddings' | 'temp_files',
    olderThan?: Date,
    dryRun: boolean = false
  ): Promise<Job> {
    return this.addJob({
      type: 'cleanup',
      data: {
        cleanupType,
        olderThan,
        dryRun
      }
    }, { priority: 1 });
  }

  /**
   * Add notification job
   */
  async addNotificationJob(
    userId: string,
    type: 'email' | 'websocket' | 'push',
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<Job> {
    return this.addJob({
      type: 'notification',
      data: {
        userId,
        type,
        title,
        message,
        metadata
      }
    }, { priority: 8 });
  }

  /**
   * Schedule recurring jobs
   */
  async scheduleRecurringJobs(): Promise<void> {
    this.logger.log('📅 Scheduling recurring jobs...');

    // Daily cleanup job
    await this.addCleanupJob('old_chats', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), false);

    // Weekly unused embeddings cleanup
    await this.addCleanupJob('unused_embeddings', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), false);

    // Daily temp files cleanup
    await this.addCleanupJob('temp_files', new Date(Date.now() - 24 * 60 * 60 * 1000), false);

    this.logger.log('✅ Recurring jobs scheduled');
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    const delayed = await this.queue.getDelayed();
    const paused = await this.queue.isPaused();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused ? 1 : 0
    };
  }

  /**
   * Get recent jobs
   */
  async getRecentJobs(limit: number = 20): Promise<Job[]> {
    const jobs = await this.queue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, limit - 1);
    return jobs;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    return this.queue.getJob(jobId);
  }

  /**
   * Remove job
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`🗑️ Job ${jobId} removed`);
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.retry();
      this.logger.log(`🔄 Job ${jobId} retried`);
    }
  }

  /**
   * Clean completed jobs
   */
  async cleanCompletedJobs(grace: number = 100): Promise<void> {
    await this.queue.clean(0, grace, 'completed');
    this.logger.log(`🧹 Cleaned completed jobs (keeping ${grace})`);
  }

  /**
   * Clean failed jobs
   */
  async cleanFailedJobs(grace: number = 50): Promise<void> {
    await this.queue.clean(0, grace, 'failed');
    this.logger.log(`🧹 Cleaned failed jobs (keeping ${grace})`);
  }

  /**
   * Pause queue
   */
  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    this.logger.log('⏸️ Queue paused');
  }

  /**
   * Resume queue
   */
  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    this.logger.log('▶️ Queue resumed');
  }

  /**
   * Get queue health
   */
  async getQueueHealth(): Promise<{
    isHealthy: boolean;
    stats: QueueStats;
    issues: string[];
  }> {
    const stats = await this.getQueueStats();
    const issues: string[] = [];

    // Check for too many failed jobs
    if (stats.failed > 100) {
      issues.push(`Too many failed jobs: ${stats.failed}`);
    }

    // Check for too many waiting jobs
    if (stats.waiting > 1000) {
      issues.push(`Too many waiting jobs: ${stats.waiting}`);
    }

    // Check if queue is paused
    if (stats.paused > 0) {
      issues.push('Queue is paused');
    }

    return {
      isHealthy: issues.length === 0,
      stats,
      issues
    };
  }
} 