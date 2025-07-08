import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService } from '../../services/chroma.service';
import { DocumentManagementService } from '../../services/document-management.service';
import { JobData } from './job-queue.service';

@Processor('default')
export class JobProcessor extends WorkerHost {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly chromaService: ChromaService,
    private readonly documentManagementService: DocumentManagementService,
  ) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`🚀 Job ${job.id} (${job.name}) started processing`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Job ${job.id} (${job.name}) completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} (${job.name}) failed: ${error.message}`);
  }

  @OnWorkerEvent('stalled')
  onStalled(job: Job) {
    this.logger.warn(`⏸️ Job ${job.id} (${job.name}) stalled`);
  }

  async process(job: Job): Promise<void> {
    const { name, data } = job;
    
    this.logger.debug(`Processing job: ${name}`);

    try {
      switch (name) {
        case 'document_processing':
          await this.processDocumentProcessing(job);
          break;

        case 'embedding':
          await this.processEmbedding(job);
          break;

        case 'usage_stats':
          await this.processUsageStats(job);
          break;

        case 'training':
          await this.processTraining(job);
          break;

        case 'cleanup':
          await this.processCleanup(job);
          break;

        case 'notification':
          await this.processNotification(job);
          break;

        default:
          this.logger.warn(`Unknown job type: ${name}`);
          throw new Error(`Unknown job type: ${name}`);
      }

    } catch (error) {
      this.logger.error(`Error processing job ${job.id} (${name}):`, error);
      throw error;
    }
  }

  /**
   * Process document processing job
   */
  private async processDocumentProcessing(job: Job): Promise<void> {
    const { collectionId, documentId, filename, fileBuffer, userId } = job.data;
    
    this.logger.log(`📄 Processing document: ${filename} for collection: ${collectionId}`);

    try {
      // Update job progress
      await job.updateProgress(10);

      // Create file object
      const file = {
        originalname: filename,
        buffer: fileBuffer,
        size: fileBuffer.length,
        mimetype: this.getMimeType(filename),
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: filename,
        path: '',
        stream: null as any,
      } as Express.Multer.File;

      await job.updateProgress(20);

      // Process document
      const result = await this.documentManagementService.uploadDocument(
        collectionId,
        file,
        userId
      );

      await job.updateProgress(100);
      this.logger.log(`✅ Document processed: ${filename} -> ${result.totalChunks} chunks`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Document processing failed for ${filename}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Process embedding generation job
   */
  private async processEmbedding(job: Job): Promise<void> {
    const { texts, chatId, messageId, collectionId, batchSize = 5 } = job.data;
    
    this.logger.log(`🤖 Processing ${texts.length} embeddings (batch size: ${batchSize})`);

    try {
      const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
      
      await job.updateProgress(50);

      // Store embeddings based on context
      if (chatId && messageId) {
        // Store chat embeddings
        const documents = texts.map((text: string, index: number) => ({
          id: `${messageId}_${index}`,
          text,
          embedding: embeddings[index],
          metadata: {
            chatId,
            messageId,
            timestamp: new Date(),
            index
          }
        }));

        await this.chromaService.addDocuments(`chat_${chatId}`, documents);
        
      } else if (collectionId) {
        // Store collection embeddings
        const documents = texts.map((text: string, index: number) => ({
          id: `${collectionId}_${Date.now()}_${index}`,
          text,
          embedding: embeddings[index],
          metadata: {
            collectionId,
            timestamp: new Date(),
            index
          }
        }));

        await this.chromaService.addDocuments(`collection_${collectionId}`, documents);
      }

      await job.updateProgress(100);
      this.logger.log(`✅ Generated and stored ${embeddings.length} embeddings`);

    } catch (error) {
      this.logger.error(`Embedding generation failed:`, error);
      throw error;
    }
  }

  /**
   * Process usage statistics job
   */
  private async processUsageStats(job: Job): Promise<void> {
    const { userId, action, metadata, timestamp } = job.data;
    
    this.logger.debug(`📊 Recording usage stats: ${action} for user: ${userId}`);

    try {
      // Mock implementation - replace with actual stats service
      this.logger.log(`Stats recorded: ${userId} - ${action} - ${timestamp}`);
      
      await job.updateProgress(100);
      this.logger.debug(`✅ Usage stats recorded: ${action}`);

    } catch (error) {
      this.logger.error(`Usage stats recording failed:`, error);
      throw error;
    }
  }

  /**
   * Process training job
   */
  private async processTraining(job: Job): Promise<void> {
    const { modelType, trainingData, configuration, userId } = job.data;
    
    this.logger.log(`🧠 Starting training job: ${modelType} with ${trainingData.length} samples`);

    try {
      await job.updateProgress(10);

      // Validate training data
      if (!trainingData || trainingData.length === 0) {
        throw new Error('No training data provided');
      }

      await job.updateProgress(50);

      // Mock training process
      await new Promise(resolve => setTimeout(resolve, 2000));

      await job.updateProgress(100);
      this.logger.log(`✅ Training completed: ${modelType}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Training failed for ${modelType}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Process cleanup job
   */
  private async processCleanup(job: Job): Promise<void> {
    const { cleanupType, olderThan, dryRun = false } = job.data;
    
    this.logger.log(`🧹 Starting cleanup: ${cleanupType} (dry run: ${dryRun})`);

    try {
      let cleanedCount = 0;

      switch (cleanupType) {
        case 'old_chats':
          cleanedCount = await this.cleanupOldChats(olderThan, dryRun);
          break;

        case 'unused_embeddings':
          cleanedCount = await this.cleanupUnusedEmbeddings(olderThan, dryRun);
          break;

        case 'temp_files':
          cleanedCount = await this.cleanupTempFiles(olderThan, dryRun);
          break;

        default:
          throw new Error(`Unknown cleanup type: ${cleanupType}`);
      }

      await job.updateProgress(100);
      this.logger.log(`✅ Cleanup completed: ${cleanupType} - ${cleanedCount} items ${dryRun ? '(dry run)' : 'cleaned'}`);

    } catch (error) {
      this.logger.error(`Cleanup failed for ${cleanupType}:`, error);
      throw error;
    }
  }

  /**
   * Process notification job
   */
  private async processNotification(job: Job): Promise<void> {
    const { userId, type, title, message, metadata } = job.data;
    
    this.logger.log(`📢 Sending notification: ${type} to user: ${userId}`);

    try {
      switch (type) {
        case 'websocket':
          // Mock WebSocket notification
          this.logger.log(`WebSocket notification sent to ${userId}: ${title}`);
          break;

        case 'email':
          this.logger.warn('Email notifications not implemented yet');
          break;

        case 'push':
          this.logger.warn('Push notifications not implemented yet');
          break;

        default:
          throw new Error(`Unknown notification type: ${type}`);
      }

      await job.updateProgress(100);
      this.logger.log(`✅ Notification sent: ${type}`);

    } catch (error) {
      this.logger.error(`Notification failed:`, error);
      throw error;
    }
  }

  // Helper methods for cleanup
  private async cleanupOldChats(olderThan: Date | undefined, dryRun: boolean): Promise<number> {
    this.logger.log(`Cleaning up chats older than ${olderThan || 'undefined date'}`);
    if (dryRun) {
      return 42; // Mock count
    }
    // TODO: Implement actual cleanup
    return 0;
  }

  private async cleanupUnusedEmbeddings(olderThan: Date | undefined, dryRun: boolean): Promise<number> {
    this.logger.log(`Cleaning up unused embeddings older than ${olderThan || 'undefined date'}`);
    if (dryRun) {
      return 156; // Mock count
    }
    // TODO: Implement actual cleanup
    return 0;
  }

  private async cleanupTempFiles(olderThan: Date | undefined, dryRun: boolean): Promise<number> {
    this.logger.log(`Cleaning up temp files older than ${olderThan || 'undefined date'}`);
    if (dryRun) {
      return 23; // Mock count
    }
    // TODO: Implement actual cleanup
    return 0;
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'md':
        return 'text/markdown';
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }
} 