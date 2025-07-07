import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CreateCollectionDto } from '../collection/dto/create-collection.dto';
import { DocumentService } from '../../services/document.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';

@Injectable()
export class TrainingService {
  private readonly chunkSize = 1000;
  private readonly chunkOverlap = 200;

  constructor(
    @Inject('BULL_QUEUE') private readonly queue: Queue,
    private readonly documentService: DocumentService,
    private readonly bedrockService: BedrockService,
  ) {}

  private splitText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += this.chunkSize - this.chunkOverlap;
    }
    return chunks;
  }

  async processBuffer(buffer: Buffer, filename: string, chatId?: string) {
    const text = await this.documentService.parseFileContent(buffer, filename);
    if (!text) return 0;
    const chunks = this.splitText(text);
    for (const chunk of chunks) {
      await this.queue.add('embed', { text: chunk, chatId, messageId: filename });
    }
    return chunks.length;
  }

  async processRawText(text: string, chatId?: string) {
    const chunks = this.splitText(text);
    for (const chunk of chunks) {
      await this.queue.add('embed', { text: chunk, chatId, messageId: `text-${Date.now()}` });
    }
    return chunks.length;
  }

  async processUrlContent(text: string, url: string) {
    const chunks = this.splitText(text);
    for (const chunk of chunks) {
      await this.queue.add('embed', { text: chunk, chatId: undefined, messageId: url });
    }
    return chunks.length;
  }
} 