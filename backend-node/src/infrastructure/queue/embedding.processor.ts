import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService } from '../../services/chroma.service';

@Processor('default')
export class EmbeddingProcessor extends WorkerHost {
  constructor(
    private readonly bedrockService: BedrockService,
    private readonly chromaService: ChromaService,
  ) {
    super();
  }

  async process(job: Job<{ text: string; chatId: string; messageId: string }>): Promise<void> {
    const { text, chatId, messageId } = job.data;
    const embedding = await this.bedrockService.embed(text);
    await this.chromaService.addDocuments(`chat:${chatId}`, [
      { id: messageId, text, embedding },
    ]);
  }
} 