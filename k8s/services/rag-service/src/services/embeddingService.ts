import axios from 'axios';
import config from '../config/config';

export class EmbeddingService {
  private bedrockServiceUrl: string;

  constructor() {
    this.bedrockServiceUrl = config.BEDROCK_SERVICE_URL;
  }

  /**
   * Get text embeddings by calling Bedrock Gateway service
   * @param input Array of text strings to embed
   * @param model Model identifier (default: amazon.titan-embed-text-v1)
   * @returns Array of embedding vectors
   */
  async getTextEmbeddings(input: string[], model: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    try {
      console.log(`[EmbeddingService] Requesting embeddings for ${input.length} texts from Bedrock Gateway`);

      const response = await axios.post(
        `${this.bedrockServiceUrl}/api/bedrock/embeddings`,
        {
          input,
          model
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (response.data && Array.isArray(response.data)) {
        console.log(`[EmbeddingService] Successfully received ${response.data.length} embeddings`);
        return response.data;
      } else {
        console.error('[EmbeddingService] Invalid response format from Bedrock Gateway:', response.data);
        throw new Error('Invalid response format from Bedrock Gateway');
      }
    } catch (error: any) {
      console.error('[EmbeddingService] Error calling Bedrock Gateway:', error.message);
      if (error.response) {
        console.error('[EmbeddingService] Response error:', error.response.status, error.response.data);
      }
      throw new Error(`Failed to get embeddings from Bedrock Gateway: ${error.message}`);
    }
  }

  /**
   * Embed a single text string
   * @param text Text to embed
   * @param model Model identifier
   * @returns Embedding vector
   */
  async embed(text: string, model: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    const embeddings = await this.getTextEmbeddings([text], model);
    return embeddings && embeddings.length > 0 ? embeddings[0] : [];
  }

  /**
   * Embed multiple text strings in batch
   * @param texts Array of texts to embed
   * @param model Model identifier
   * @returns Array of embedding vectors
   */
  async embedBatch(texts: string[], model: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    return this.getTextEmbeddings(texts, model);
  }
}

export const embeddingService = new EmbeddingService();
