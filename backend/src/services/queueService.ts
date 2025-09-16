import Queue from 'bull';
import { trainingService } from './trainingService';
import { IUser } from '../models/user';
import { smartMemoryService } from './smartMemoryService';
import { ChatModel } from '../models/chat';
import { chromaService } from './chromaService';
import { usageService } from './usageService';

// Import WebSocket service for progress updates
let wsService: any = null;
try {
  // Dynamic import to avoid circular dependency
  wsService = require('./websocketService').WebSocketService;
} catch (error) {
  console.warn('WebSocket service not available for queue progress updates');
}

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
  fileName?: string;
  jobType: 'file_processing' | 'memory_cleanup' | 'maintenance' | 'embedding_sync' | 'analytics';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: {
    chunksCount?: number;
    processingTime: number;
    itemsProcessed?: number;
    details?: any;
  };
}

interface MemoryCleanupJob {
  sessionId: string;
  cutoffDate: Date;
  jobId: string;
}

interface MaintenanceJob {
  taskType: 'chat_cleanup' | 'index_optimization' | 'analytics_aggregation' | 'collection_sync';
  parameters?: any;
  jobId: string;
}

interface EmbeddingSyncJob {
  collectionName: string;
  batchSize: number;
  startFrom?: string;
  jobId: string;
}

export class QueueService {
  private fileProcessingQueue: Queue.Queue<FileProcessingJob>;
  private memoryCleanupQueue: Queue.Queue<MemoryCleanupJob>;
  private maintenanceQueue: Queue.Queue<MaintenanceJob>;
  private embeddingSyncQueue: Queue.Queue<EmbeddingSyncJob>;
  private progressMap: Map<string, ProcessingProgress> = new Map();

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
    };

    const defaultJobOptions = {
      removeOnComplete: 10, // Keep last 10 completed jobs
      removeOnFail: 50,     // Keep last 50 failed jobs
      attempts: 3,          // Retry failed jobs 3 times
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    };

    // Initialize multiple queues for different task types
    this.fileProcessingQueue = new Queue('file processing', {
      redis: redisConfig,
      defaultJobOptions,
    });

    this.memoryCleanupQueue = new Queue('memory cleanup', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        removeOnComplete: 5,
        attempts: 2,
      },
    });

    this.maintenanceQueue = new Queue('maintenance', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        removeOnComplete: 20,
        attempts: 1, // Maintenance tasks shouldn't retry automatically
      },
    });

    this.embeddingSyncQueue = new Queue('embedding sync', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        removeOnComplete: 5,
        attempts: 3,
      },
    });

    this.setupProcessors();
    this.setupEventListeners();
    this.schedulePeriodicTasks();
  }

  private setupProcessors() {
    // Process file upload jobs
    this.fileProcessingQueue.process('processFile', 5, async (job) => {
      const { fileBuffer, fileName, user, modelId, collectionName, jobId } = job.data;
      
      console.log(`🔄 Processing job ${jobId}: ${fileName}`);
      
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

        console.log(`✅ Job ${jobId} completed: ${chunksCount} chunks in ${processingTime}ms`);
        
        return {
          chunksCount,
          processingTime,
          fileName,
          collectionName,
        };
      } catch (error: any) {
        console.error(`❌ Job ${jobId} failed:`, error);
        
        this.updateProgress(jobId, {
          status: 'failed',
          progress: 0,
          error: error?.message || error,
        });

        throw error;
      }
    });

    // Process memory cleanup jobs
    this.memoryCleanupQueue.process('cleanupMemory', 2, async (job) => {
      const { sessionId, cutoffDate, jobId } = job.data;

      console.log(`🧹 Processing memory cleanup job ${jobId} for session ${sessionId}`);

      this.updateProgress(jobId, {
        status: 'processing',
        progress: 10,
        jobType: 'memory_cleanup',
      });

      try {
        const startTime = Date.now();

        // Clear old Redis entries
        this.updateProgress(jobId, { status: 'processing', progress: 30, jobType: 'memory_cleanup' });
        await smartMemoryService.clearSession(sessionId);

        // Clean up ChromaDB entries
        this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'memory_cleanup' });
        // ChromaDB cleanup - placeholder
        const deletedCount = 0; // Would implement actual cleanup logic

        const processingTime = Date.now() - startTime;

        this.updateProgress(jobId, {
          status: 'completed',
          progress: 100,
          jobType: 'memory_cleanup',
          result: {
            processingTime,
            itemsProcessed: deletedCount,
            details: { sessionId, cutoffDate }
          },
        });

        console.log(`✅ Memory cleanup job ${jobId} completed: ${deletedCount} items in ${processingTime}ms`);

        return { deletedCount, processingTime };
      } catch (error: any) {
        console.error(`❌ Memory cleanup job ${jobId} failed:`, error);

        this.updateProgress(jobId, {
          status: 'failed',
          progress: 0,
          jobType: 'memory_cleanup',
          error: error?.message || error,
        });

        throw error;
      }
    });

    // Process maintenance jobs
    this.maintenanceQueue.process('maintenance', 1, async (job) => {
      const { taskType, parameters, jobId } = job.data;

      console.log(`🔧 Processing maintenance job ${jobId}: ${taskType}`);

      this.updateProgress(jobId, {
        status: 'processing',
        progress: 10,
        jobType: 'maintenance',
      });

      try {
        const startTime = Date.now();
        let result;

        switch (taskType) {
          case 'chat_cleanup':
            result = await this.performChatCleanup(jobId);
            break;
          case 'index_optimization':
            result = await this.performIndexOptimization(jobId);
            break;
          case 'analytics_aggregation':
            result = await this.performAnalyticsAggregation(jobId);
            break;
          case 'collection_sync':
            result = await this.performCollectionSync(jobId, parameters);
            break;
          default:
            throw new Error(`Unknown maintenance task: ${taskType}`);
        }

        const processingTime = Date.now() - startTime;

        this.updateProgress(jobId, {
          status: 'completed',
          progress: 100,
          jobType: 'maintenance',
          result: {
            processingTime,
            itemsProcessed: result.itemsProcessed || 0,
            details: result
          },
        });

        console.log(`✅ Maintenance job ${jobId} (${taskType}) completed in ${processingTime}ms`);

        return result;
      } catch (error: any) {
        console.error(`❌ Maintenance job ${jobId} failed:`, error);

        this.updateProgress(jobId, {
          status: 'failed',
          progress: 0,
          jobType: 'maintenance',
          error: error?.message || error,
        });

        throw error;
      }
    });

    // Process embedding sync jobs
    this.embeddingSyncQueue.process('syncEmbeddings', 1, async (job) => {
      const { collectionName, batchSize, startFrom, jobId } = job.data;

      console.log(`🔄 Processing embedding sync job ${jobId} for collection ${collectionName}`);

      this.updateProgress(jobId, {
        status: 'processing',
        progress: 10,
        jobType: 'embedding_sync',
      });

      try {
        const startTime = Date.now();

        // Sync embeddings in batches
        let processed = 0;
        let currentStart = startFrom;

        while (true) {
          this.updateProgress(jobId, {
            status: 'processing',
            progress: Math.min(10 + (processed / batchSize) * 80, 90),
            jobType: 'embedding_sync',
          });

          // Placeholder for embedding sync - would need implementation
          const batchResult = {
            processed: Math.min(batchSize, 50), // Simulate processing
            hasMore: processed < 100, // Stop after 100 items for demo
            nextStart: (processed + batchSize).toString()
          };

          processed += batchResult.processed;

          if (!batchResult.hasMore) break;
          currentStart = batchResult.nextStart;
        }

        const processingTime = Date.now() - startTime;

        this.updateProgress(jobId, {
          status: 'completed',
          progress: 100,
          jobType: 'embedding_sync',
          result: {
            processingTime,
            itemsProcessed: processed,
            details: { collectionName, batchSize }
          },
        });

        console.log(`✅ Embedding sync job ${jobId} completed: ${processed} items in ${processingTime}ms`);

        return { processed, processingTime };
      } catch (error: any) {
        console.error(`❌ Embedding sync job ${jobId} failed:`, error);

        this.updateProgress(jobId, {
          status: 'failed',
          progress: 0,
          jobType: 'embedding_sync',
          error: error?.message || error,
        });

        throw error;
      }
    });
  }

  private setupEventListeners() {
    this.fileProcessingQueue.on('completed', (job, result) => {
      console.log(`🎉 Job ${job.id} completed:`, result);
    });

    this.fileProcessingQueue.on('failed', (job, err) => {
      console.error(`💥 Job ${job.id} failed:`, err.message);
    });

    this.fileProcessingQueue.on('progress', (job, progress) => {
      console.log(`📊 Job ${job.id} progress: ${progress}%`);
    });

    this.fileProcessingQueue.on('stalled', (job) => {
      console.warn(`⏳ Job ${job.id} stalled`);
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
      jobType: 'file_processing',
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

    console.log(`📝 Added job ${jobId} to queue (Bull Job ID: ${job.id})`);
    
    return jobId;
  }

  async addMemoryCleanupJob(sessionId: string, cutoffDate: Date): Promise<string> {
    const jobId = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.progressMap.set(jobId, {
      jobId,
      userId: 'system',
      jobType: 'memory_cleanup',
      status: 'queued',
      progress: 0,
    });

    const job = await this.memoryCleanupQueue.add(
      'cleanupMemory',
      { sessionId, cutoffDate, jobId },
      { priority: 2 }
    );

    console.log(`📝 Added memory cleanup job ${jobId} to queue (Bull Job ID: ${job.id})`);
    return jobId;
  }

  async addMaintenanceJob(taskType: 'chat_cleanup' | 'index_optimization' | 'analytics_aggregation' | 'collection_sync', parameters?: any): Promise<string> {
    const jobId = `maintenance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.progressMap.set(jobId, {
      jobId,
      userId: 'system',
      jobType: 'maintenance',
      status: 'queued',
      progress: 0,
    });

    const job = await this.maintenanceQueue.add(
      'maintenance',
      { taskType, parameters, jobId },
      { priority: 3 }
    );

    console.log(`📝 Added maintenance job ${jobId} (${taskType}) to queue (Bull Job ID: ${job.id})`);
    return jobId;
  }

  async addEmbeddingSyncJob(collectionName: string, batchSize: number = 100, startFrom?: string): Promise<string> {
    const jobId = `embedding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.progressMap.set(jobId, {
      jobId,
      userId: 'system',
      jobType: 'embedding_sync',
      status: 'queued',
      progress: 0,
    });

    const job = await this.embeddingSyncQueue.add(
      'syncEmbeddings',
      { collectionName, batchSize, startFrom, jobId },
      { priority: 4 }
    );

    console.log(`📝 Added embedding sync job ${jobId} for collection ${collectionName} to queue (Bull Job ID: ${job.id})`);
    return jobId;
  }

  private updateProgress(jobId: string, updates: Partial<ProcessingProgress>) {
    const current = this.progressMap.get(jobId);
    if (current) {
      const updated = { ...current, ...updates };
      this.progressMap.set(jobId, updated);
      
      console.log(`📊 Progress update for job ${jobId}:`, updated);
      
      // Emit progress update via WebSocket if available
      if (wsService && updated.userId) {
        try {
          wsService.emitProgressUpdate(updated.userId, {
            type: 'upload-progress',
            jobId: updated.jobId,
            fileName: updated.fileName,
            status: updated.status,
            progress: updated.progress,
            error: updated.error,
            result: updated.result
          });
        } catch (error) {
          console.warn('Failed to emit progress update via WebSocket:', error);
        }
      }
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

    console.log(`🧹 Cleaned up old jobs, keeping ${this.progressMap.size} recent jobs`);
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

  private async performChatCleanup(jobId: string): Promise<any> {
    this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });

    // Clean up old deleted chats
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days old

    const deletedChats = await ChatModel.deleteMany({
      isDeleted: true,
      deletedAt: { $lt: cutoffDate }
    });

    this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'maintenance' });

    // Clean up orphaned memory entries - placeholder
    const cleanedMemories = 0; // Would implement actual cleanup logic

    this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });

    return {
      itemsProcessed: deletedChats.deletedCount + cleanedMemories,
      deletedChats: deletedChats.deletedCount,
      cleanedMemories
    };
  }

  private async performIndexOptimization(jobId: string): Promise<any> {
    this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });

    // Optimize chat indexes - placeholder
    const chatIndexStats = { optimized: true }; // Would implement actual reindexing

    this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'maintenance' });

    // Perform ChromaDB optimization - placeholder
    const chromaStats = { optimizedCollections: 0 }; // Would implement actual optimization

    this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });

    return {
      itemsProcessed: Object.keys(chatIndexStats).length + chromaStats.optimizedCollections,
      chatIndexStats,
      chromaStats
    };
  }

  private async performAnalyticsAggregation(jobId: string): Promise<any> {
    this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });

    // Aggregate usage statistics - placeholder
    const usageStats = { aggregatedDays: 0 }; // Would implement actual aggregation

    this.updateProgress(jobId, { status: 'processing', progress: 60, jobType: 'maintenance' });

    // Generate chat analytics
    const chatStats = await this.generateChatAnalytics();

    this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });

    return {
      itemsProcessed: usageStats.aggregatedDays + chatStats.totalChats,
      usageStats,
      chatStats
    };
  }

  private async performCollectionSync(jobId: string, parameters?: any): Promise<any> {
    this.updateProgress(jobId, { status: 'processing', progress: 20, jobType: 'maintenance' });

    // Collection sync - placeholder
    const syncResults = { totalSynced: 0 }; // Would implement actual sync logic

    this.updateProgress(jobId, { status: 'processing', progress: 90, jobType: 'maintenance' });

    return {
      itemsProcessed: syncResults.totalSynced,
      ...syncResults
    };
  }

  private async generateChatAnalytics(): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            agentId: "$agentId"
          },
          chatCount: { $sum: 1 },
          messageCount: { $sum: { $size: "$messages" } }
        }
      }
    ];

    const analytics = await ChatModel.aggregate(pipeline);

    return {
      totalChats: analytics.length,
      analytics
    };
  }

  private schedulePeriodicTasks(): void {
    console.log('📅 Scheduling periodic maintenance tasks...');

    // Schedule daily maintenance at 2 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        await this.addMaintenanceJob('chat_cleanup');
        await this.addMaintenanceJob('analytics_aggregation');
      }
    }, 60000); // Check every minute

    // Schedule weekly index optimization on Sundays at 3 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() === 0 && now.getHours() === 3 && now.getMinutes() === 0) {
        await this.addMaintenanceJob('index_optimization');
        await this.addMaintenanceJob('collection_sync');
      }
    }, 60000); // Check every minute

    // Schedule memory cleanup every 6 hours
    setInterval(async () => {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 24); // Clean up 24+ hour old entries

      // This would need session IDs from active sessions
      // For now, this is a placeholder for session-specific cleanup
      console.log('🧹 Periodic memory cleanup would trigger here');
    }, 6 * 60 * 60 * 1000); // Every 6 hours

    console.log('✅ Periodic tasks scheduled');
  }

  async shutdown() {
    console.log('🛑 Shutting down queue service...');
    await this.fileProcessingQueue.close();
    await this.memoryCleanupQueue.close();
    await this.maintenanceQueue.close();
    await this.embeddingSyncQueue.close();
  }
}

export const queueService = new QueueService();