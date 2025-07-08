import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';
import { JwtAuthGuard } from '../../modules/auth/jwt.guard';
import { RolesGuard } from '../../modules/auth/roles.guard';
import { Roles } from '../../modules/auth/roles.decorator';

@Controller('admin/queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'SuperAdmin')
export class QueueController {
  constructor(private readonly jobQueueService: JobQueueService) {}

  /**
   * Get queue statistics
   */
  @Get('stats')
  async getQueueStats() {
    const stats = await this.jobQueueService.getQueueStats();
    return {
      message: 'Queue statistics retrieved successfully',
      data: stats
    };
  }

  /**
   * Get queue health
   */
  @Get('health')
  async getQueueHealth() {
    const health = await this.jobQueueService.getQueueHealth();
    return {
      message: 'Queue health checked successfully',
      data: health
    };
  }

  /**
   * Get recent jobs
   */
  @Get('jobs')
  async getRecentJobs(@Query('limit') limit: string = '20') {
    const jobs = await this.jobQueueService.getRecentJobs(parseInt(limit, 10));
    
    const jobsData = jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      delay: job.delay,
      opts: job.opts,
      timestamp: job.timestamp
    }));

    return {
      message: 'Recent jobs retrieved successfully',
      data: jobsData
    };
  }

  /**
   * Get specific job
   */
  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    const job = await this.jobQueueService.getJob(id);
    
    if (!job) {
      return {
        message: 'Job not found',
        data: null
      };
    }

    return {
      message: 'Job retrieved successfully',
      data: {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        delay: job.delay,
        opts: job.opts,
        timestamp: job.timestamp,
        returnvalue: job.returnvalue
      }
    };
  }

  /**
   * Add document processing job
   */
  @Post('jobs/document-processing')
  async addDocumentProcessingJob(@Body() body: {
    collectionId: string;
    documentId: string;
    filename: string;
    fileBuffer: string; // Base64 encoded
    userId: string;
    priority?: number;
  }) {
    const { collectionId, documentId, filename, fileBuffer, userId, priority } = body;
    
    // Decode base64 file buffer
    const buffer = Buffer.from(fileBuffer, 'base64');
    
    const job = await this.jobQueueService.addDocumentProcessingJob(
      collectionId,
      documentId,
      filename,
      buffer,
      userId,
      priority
    );

    return {
      message: 'Document processing job added successfully',
      data: {
        id: job.id,
        name: job.name,
        priority: job.opts.priority
      }
    };
  }

  /**
   * Add usage stats job
   */
  @Post('jobs/usage-stats')
  async addUsageStatsJob(@Body() body: {
    userId: string;
    action: 'chat' | 'document_upload' | 'search' | 'agent_execution';
    metadata?: Record<string, any>;
  }) {
    const { userId, action, metadata } = body;
    
    const job = await this.jobQueueService.addUsageStatsJob(userId, action, metadata);

    return {
      message: 'Usage stats job added successfully',
      data: {
        id: job.id,
        name: job.name
      }
    };
  }

  /**
   * Add training job
   */
  @Post('jobs/training')
  async addTrainingJob(@Body() body: {
    modelType: string;
    trainingData: any[];
    configuration: Record<string, any>;
    userId: string;
  }) {
    const { modelType, trainingData, configuration, userId } = body;
    
    const job = await this.jobQueueService.addTrainingJob(
      modelType,
      trainingData,
      configuration,
      userId
    );

    return {
      message: 'Training job added successfully',
      data: {
        id: job.id,
        name: job.name
      }
    };
  }

  /**
   * Add cleanup job
   */
  @Post('jobs/cleanup')
  async addCleanupJob(@Body() body: {
    cleanupType: 'old_chats' | 'unused_embeddings' | 'temp_files';
    olderThan?: string; // ISO date string
    dryRun?: boolean;
  }) {
    const { cleanupType, olderThan, dryRun = false } = body;
    
    const olderThanDate = olderThan ? new Date(olderThan) : undefined;
    
    const job = await this.jobQueueService.addCleanupJob(
      cleanupType,
      olderThanDate,
      dryRun
    );

    return {
      message: 'Cleanup job added successfully',
      data: {
        id: job.id,
        name: job.name
      }
    };
  }

  /**
   * Schedule recurring jobs
   */
  @Post('schedule-recurring')
  async scheduleRecurringJobs(@Request() req) {
    await this.jobQueueService.scheduleRecurringJobs();

    return {
      message: 'Recurring jobs scheduled successfully'
    };
  }

  /**
   * Retry failed job
   */
  @Post('jobs/:id/retry')
  async retryJob(@Param('id') id: string) {
    await this.jobQueueService.retryJob(id);

    return {
      message: 'Job retry initiated successfully'
    };
  }

  /**
   * Remove job
   */
  @Delete('jobs/:id')
  async removeJob(@Param('id') id: string) {
    await this.jobQueueService.removeJob(id);

    return {
      message: 'Job removed successfully'
    };
  }

  /**
   * Clean completed jobs
   */
  @Post('cleanup/completed')
  async cleanCompletedJobs(@Body() body: { grace?: number }) {
    const { grace = 100 } = body;
    await this.jobQueueService.cleanCompletedJobs(grace);

    return {
      message: 'Completed jobs cleaned successfully'
    };
  }

  /**
   * Clean failed jobs
   */
  @Post('cleanup/failed')
  async cleanFailedJobs(@Body() body: { grace?: number }) {
    const { grace = 50 } = body;
    await this.jobQueueService.cleanFailedJobs(grace);

    return {
      message: 'Failed jobs cleaned successfully'
    };
  }

  /**
   * Pause queue
   */
  @Post('pause')
  async pauseQueue() {
    await this.jobQueueService.pauseQueue();

    return {
      message: 'Queue paused successfully'
    };
  }

  /**
   * Resume queue
   */
  @Post('resume')
  async resumeQueue() {
    await this.jobQueueService.resumeQueue();

    return {
      message: 'Queue resumed successfully'
    };
  }
} 