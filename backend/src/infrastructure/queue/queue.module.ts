import { Global, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EmbeddingProcessor } from './embedding.processor';
import { JobProcessor } from './job.processor';
import { JobQueueService } from './job-queue.service';
import { QueueController } from './queue.controller';
import { ChromaService } from '../../services/chroma.service';
import { DocumentManagementService } from '../../services/document-management.service';
import { DocumentService } from '../../services/document.service';
import { AgentModule } from '../../modules/agents/agent.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { MemoryService } from '../../services/memory.service';

@Global()
@Module({
  providers: [
    {
      provide: 'BULL_QUEUE',
      useFactory: () => {
        // Check if REDIS_URL is provided (for docker-compose or production)
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          return new Queue('default', {
            connection: {
              url: redisUrl,
            },
          });
        }
        
        // Fall back to individual environment variables
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379');
        const password = process.env.REDIS_PASSWORD;
        const db = parseInt(process.env.REDIS_DB || '0');
        
        return new Queue('default', {
          connection: {
            host,
            port,
            password,
            db,
          },
        });
      },
    },
    ChromaService,
    DocumentService,
    DocumentManagementService,
    JobQueueService,
    EmbeddingProcessor,
    JobProcessor,
    MemoryService,
  ],
  imports: [AgentModule, BedrockModule],
  exports: ['BULL_QUEUE', MemoryService, JobQueueService],
  controllers: [QueueController],
})
export class QueueModule {} 