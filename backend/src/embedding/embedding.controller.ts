import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmbeddingService } from './embedding.service';

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post('embedding')
  async computeEmbeddings(@Body() body: { texts: string[]; modelId?: string }) {
    try {
      const embeddings = await this.embeddingService.computeEmbeddings(
        body.texts,
        body.modelId
      );
      
      return {
        embeddings,
        modelId: body.modelId || 'amazon.titan-embed-text-v1',
        count: embeddings.length
      };
    } catch (error) {
      throw error;
    }
  }
} 