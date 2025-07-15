import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { BedrockService } from '../bedrock/bedrock.service';

@Injectable()
export class EmbeddingService {
  constructor(
    private configService: ConfigService,
    private bedrockService: BedrockService
  ) {}
  
  /**
   * Compute embeddings for a list of texts using Bedrock
   * This matches the FastAPI /embedding endpoint functionality
   */
  async computeEmbeddings(texts: string[], modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    try {
      if (!texts || texts.length === 0) {
        throw new BadRequestException('Texts array cannot be empty');
      }

      if (texts.length > 100) {
        throw new BadRequestException('Cannot process more than 100 texts at once');
      }

      console.log(`Computing embeddings for ${texts.length} texts using model: ${modelId}`);

      // Use BedrockService to generate embeddings
      const embeddings = await this.bedrockService.generateBatchEmbeddings(texts, modelId);

      console.log(`Successfully computed ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('Error computing embeddings:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to compute embeddings: ${error.message}`);
    }
  }

  /**
   * Compute a single embedding for a text
   */
  async computeEmbedding(text: string, modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new BadRequestException('Text cannot be empty');
      }

      console.log(`Computing embedding for text using model: ${modelId}`);

      const embedding = await this.bedrockService.generateEmbedding(text, modelId);

      console.log('Successfully computed embedding');
      return embedding;
    } catch (error) {
      console.error('Error computing embedding:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to compute embedding: ${error.message}`);
    }
  }
} 