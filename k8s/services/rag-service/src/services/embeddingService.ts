import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export class EmbeddingService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Get text embeddings using AWS SDK directly
   * @param input Array of text strings to embed
   * @param model Model identifier (default: amazon.titan-embed-text-v1)
   * @returns Array of embedding vectors
   */
  async getTextEmbeddings(input: string[], model: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    if (!input || input.length === 0) {
      return [];
    }

    console.log(`[EmbeddingService] Creating embeddings for ${input.length} texts`);

    try {
      const embeddings: number[][] = [];

      for (const text of input) {
        const embedding = await this.createSingleEmbedding(text, model);
        embeddings.push(embedding);
      }

      console.log(`[EmbeddingService] Successfully created ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error: any) {
      console.error('[EmbeddingService] Error creating embeddings:', error.message);
      throw new Error(`Failed to create embeddings: ${error.message}`);
    }
  }

  /**
   * Create a single text embedding
   */
  private async createSingleEmbedding(text: string, modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Empty text provided for embedding');
      }

      // Truncate text if too long (Titan limit is ~8000 tokens)
      const maxLength = 25000;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

      const input = {
        inputText: truncatedText,
      };

      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        body: JSON.stringify(input),
      });

      const response = await this.client.send(command);

      if (!response.body) {
        throw new Error('Empty response from Bedrock');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
        throw new Error('Invalid embedding response format');
      }

      return responseBody.embedding;

    } catch (error: any) {
      console.error('[EmbeddingService] Error creating text embedding:', error.message);

      // For development/testing, return dummy embeddings
      if (process.env.NODE_ENV === 'development') {
        console.log('[EmbeddingService] Development mode: Returning dummy embedding');
        return new Array(1536).fill(0.001);
      }

      throw error;
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
