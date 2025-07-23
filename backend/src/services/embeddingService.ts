import { bedrockService } from './bedrockService';

export class EmbeddingService {
  async getTextEmbeddings(input: string[], model: string = 'amazon.titan-embed-text-v1') {
    // model argument is for compatibility, currently only titan-embed-text-v1 is used
    return bedrockService.createBatchTextEmbeddings(input);
  }
}

export const embeddingService = new EmbeddingService(); 