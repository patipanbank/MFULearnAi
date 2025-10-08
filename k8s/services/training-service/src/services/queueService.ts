import Queue from 'bull';
import config from '../config/config';
import { trainingService } from './trainingService';
import { IUser } from '../models/user';

interface FileProcessingJob {
  fileBuffer: Buffer;
  fileName: string;
  user: IUser;
  modelId: string;
  collectionName: string;
  jobId: string;
}

interface ProcessingProgress {
  jobId: string;
  userId: string;
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: {
    chunksCount: number;
    processingTime: number;
  };
}

export class QueueService {
  private fileProcessingQueue: Queue.Queue<FileProcessingJob>;
  private progressMap: Map<string, ProcessingProgress> = new Map();

  constructor() {
    // Initialize Bull queue with Redis connection
    this.fileProcessingQueue = new Queue('file processing', {
      redis: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD,
        db: 0,
      },
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 50,     // Keep last 50 failed jobs
        attempts: 3,          // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.setupProcessors();
    this.setupEventListeners();
  }

  private setupProcessors() {
    // Process file upload jobs
    this.fileProcessingQueue.process('processFile', 5, async (job) => {
      const { fileBuffer, fileName, user, modelId, collectionName, jobId } = job.data;

      console.log(`Processing job ${jobId}: ${fileName}`);

      // Update progress - File received
      this.updateProgress(jobId, {
        status: 'processing',
        progress: 5,
      });

      try {
        const startTime = Date.now();

        // Progress - Starting file parsing
        this.updateProgress(jobId, {
          status: 'processing',
          progress: 15,
        });

        // Create enhanced training service with progress callbacks
        const chunksCount = await this.processFileWithProgress(
          fileBuffer,
          fileName,
          user,
          modelId,
          collectionName,
          jobId
        );

        const processingTime = Date.now() - startTime;

        // Update progress to completed
        this.updateProgress(jobId, {
          status: 'completed',
          progress: 100,
          result: {
            chunksCount,
            processingTime,
          },
        });

        console.log(`Job ${jobId} completed: ${chunksCount} chunks in ${processingTime}ms`);

        return {
          chunksCount,
          processingTime,
          fileName,
          collectionName,
        };
      } catch (error: any) {
        console.error(`Job ${jobId} failed:`, error);

        this.updateProgress(jobId, {
          status: 'failed',
          progress: 0,
          error: error?.message || error,
        });

        throw error;
      }
    });
  }

  private setupEventListeners() {
    this.fileProcessingQueue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed:`, result);
    });

    this.fileProcessingQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });

    this.fileProcessingQueue.on('progress', (job, progress) => {
      console.log(`Job ${job.id} progress: ${progress}%`);
    });

    this.fileProcessingQueue.on('stalled', (job) => {
      console.warn(`Job ${job.id} stalled`);
    });
  }

  async addFileProcessingJob(
    fileBuffer: Buffer,
    fileName: string,
    user: IUser,
    modelId: string,
    collectionName: string
  ): Promise<string> {
    const jobId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize progress tracking
    this.progressMap.set(jobId, {
      jobId,
      userId: user._id?.toString() || 'unknown',
      fileName,
      status: 'queued',
      progress: 0,
    });

    // Add job to queue
    const job = await this.fileProcessingQueue.add(
      'processFile',
      {
        fileBuffer,
        fileName,
        user,
        modelId,
        collectionName,
        jobId,
      },
      {
        priority: 1,
        delay: 0,
      }
    );

    console.log(`Added job ${jobId} to queue (Bull Job ID: ${job.id})`);

    return jobId;
  }

  private updateProgress(jobId: string, updates: Partial<ProcessingProgress>) {
    const current = this.progressMap.get(jobId);
    if (current) {
      const updated = { ...current, ...updates };
      this.progressMap.set(jobId, updated);

      console.log(`Progress update for job ${jobId}:`, updated);
    }
  }

  getJobProgress(jobId: string): ProcessingProgress | null {
    return this.progressMap.get(jobId) || null;
  }

  getAllJobsForUser(userId: string): ProcessingProgress[] {
    return Array.from(this.progressMap.values())
      .filter(progress => progress.userId === userId)
      .sort((a, b) => b.jobId.localeCompare(a.jobId)); // Latest first
  }

  async getQueueStats() {
    const waiting = await this.fileProcessingQueue.getWaiting();
    const active = await this.fileProcessingQueue.getActive();
    const completed = await this.fileProcessingQueue.getCompleted();
    const failed = await this.fileProcessingQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: this.progressMap.size,
    };
  }

  async cleanupOldJobs() {
    // Clean up progress map (keep only last 100 jobs)
    const allJobs = Array.from(this.progressMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 100);

    this.progressMap.clear();
    allJobs.forEach(([jobId, progress]) => {
      this.progressMap.set(jobId, progress);
    });

    console.log(`Cleaned up old jobs, keeping ${this.progressMap.size} recent jobs`);
  }

  private async processFileWithProgress(
    fileBuffer: Buffer,
    fileName: string,
    user: IUser,
    modelId: string,
    collectionName: string,
    jobId: string
  ): Promise<number> {
    // Progress - Parsing file content
    this.updateProgress(jobId, {
      status: 'processing',
      progress: 25,
    });

    const textContent = await trainingService.parseFileContent(fileBuffer, fileName);

    // Progress - File parsed, starting text splitting
    this.updateProgress(jobId, {
      status: 'processing',
      progress: 40,
    });

    const chunks = await trainingService.splitTextWithProgress(textContent, (progress) => {
      this.updateProgress(jobId, {
        status: 'processing',
        progress: 40 + (progress * 0.15), // 40% + up to 15% for splitting
      });
    });

    // Progress - Creating embeddings
    this.updateProgress(jobId, {
      status: 'processing',
      progress: 55,
    });

    const embeddings = await trainingService.createEmbeddingsWithProgress(chunks, modelId, (progress) => {
      this.updateProgress(jobId, {
        status: 'processing',
        progress: 55 + (progress * 0.25), // 55% + up to 25% for embeddings
      });
    });

    // Progress - Storing in ChromaDB
    this.updateProgress(jobId, {
      status: 'processing',
      progress: 80,
    });

    const result = await trainingService.storeDocumentsWithProgress(
      chunks,
      embeddings,
      fileName,
      user,
      modelId,
      collectionName,
      (progress) => {
        this.updateProgress(jobId, {
          status: 'processing',
          progress: 80 + (progress * 0.15), // 80% + up to 15% for storage
        });
      }
    );

    // Progress - Recording history
    this.updateProgress(jobId, {
      status: 'processing',
      progress: 95,
    });

    return result;
  }

  async shutdown() {
    console.log('Shutting down queue service...');
    await this.fileProcessingQueue.close();
  }
}

export const queueService = new QueueService();
