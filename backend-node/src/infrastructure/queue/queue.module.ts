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
        return new Queue('default', {
          connection: {
            url: process.env.REDIS_URL || 'redis://localhost:6379',
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