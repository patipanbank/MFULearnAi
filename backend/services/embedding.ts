import { bedrockService } from './bedrock';

export class EmbeddingService {
  async embed(text: string): Promise<number[]> {
    try {
      return await bedrockService.embed(text);
    } catch (error) {
      console.error('Embedding error:', error);
      throw error;
    }
  }
}

export const embeddingService = new EmbeddingService(); 