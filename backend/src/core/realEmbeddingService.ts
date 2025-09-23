/**
 * 🔧 Real Embedding Service
 *
 * ใช้ AWS Bedrock Embeddings API จริง ไม่ใช่ dummy
 * - ใช้ amazon.titan-embed-text-v1
 * - Real vector embeddings
 * - Cache mechanism สำหรับ performance
 * - Error handling และ retry logic
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromEnv } from '@aws-sdk/credential-provider-env';

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  maxRetries?: number;
}

export class RealEmbeddingService {
  private client: BedrockRuntimeClient;
  private cache: Map<string, number[]> = new Map();
  private options: Required<EmbeddingOptions>;

  constructor(options: EmbeddingOptions = {}) {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: fromEnv(),
      maxAttempts: 3
    });

    this.options = {
      model: options.model || 'amazon.titan-embed-text-v1',
      dimensions: options.dimensions || 1536,
      maxRetries: options.maxRetries || 3
    };

    console.log(`🔧 Real Embedding Service initialized with model: ${this.options.model}`);
  }

  /**
   * Generate real embeddings using AWS Bedrock
   */
  async embed(text: string, options?: Partial<EmbeddingOptions>): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      console.warn('⚠️ Empty text provided for embedding');
      return [];
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      console.log('📋 Returning cached embedding');
      return this.cache.get(cacheKey)!;
    }

    const effectiveOptions = { ...this.options, ...options };
    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 1; attempt <= effectiveOptions.maxRetries; attempt++) {
      try {
        console.log(`🔄 Generating embedding (attempt ${attempt}/${effectiveOptions.maxRetries})`);

        const embedding = await this.generateEmbedding(text, effectiveOptions);

        // Cache the result
        this.cache.set(cacheKey, embedding);

        // Limit cache size
        if (this.cache.size > 1000) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
            this.cache.delete(firstKey);
          }
        }

        console.log(`✅ Embedding generated successfully (${embedding.length} dimensions)`);
        return embedding;

      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Embedding attempt ${attempt} failed:`, error);

        if (attempt < effectiveOptions.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to generate embedding after ${effectiveOptions.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[], options?: Partial<EmbeddingOptions>): Promise<number[][]> {
    console.log(`📦 Generating embeddings for ${texts.length} texts`);

    const embeddings: number[][] = [];
    const batchSize = 5; // Process in batches to avoid rate limits

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

      const batchPromises = batch.map(text => this.embed(text, options));
      const batchResults = await Promise.all(batchPromises);

      embeddings.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Generated ${embeddings.length} embeddings`);
    return embeddings;
  }

  /**
   * Generate single embedding using Bedrock API
   */
  private async generateEmbedding(text: string, options: Required<EmbeddingOptions>): Promise<number[]> {
    const body = {
      inputText: text.trim()
    };

    const command = new InvokeModelCommand({
      modelId: options.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body)
    });

    const response = await this.client.send(command);

    if (!response.body) {
      throw new Error('No response body from Bedrock API');
    }

    const responseBody = JSON.parse(Buffer.from(response.body).toString());

    if (!responseBody.embedding) {
      throw new Error('No embedding in response from Bedrock API');
    }

    const embedding = responseBody.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding format from Bedrock API');
    }

    // Validate embedding dimensions
    if (embedding.length !== this.getExpectedDimensions(options.model)) {
      console.warn(`⚠️ Unexpected embedding dimensions: got ${embedding.length}, expected ${this.getExpectedDimensions(options.model)}`);
    }

    return embedding;
  }

  /**
   * Get expected dimensions for different models
   */
  private getExpectedDimensions(model: string): number {
    const dimensionMap: Record<string, number> = {
      'amazon.titan-embed-text-v1': 1536,
      'amazon.titan-embed-text-v2:0': 1024,
      'cohere.embed-english-v3': 1024,
      'cohere.embed-multilingual-v3': 1024
    };

    return dimensionMap[model] || 1536;
  }

  /**
   * Generate cache key for text
   */
  private getCacheKey(text: string): string {
    // Simple hash for caching
    return Buffer.from(text).toString('base64').slice(0, 50);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar embeddings
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: number[][],
    topK: number = 5
  ): Array<{ index: number; similarity: number }> {
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      index,
      similarity: this.calculateSimilarity(queryEmbedding, embedding)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Embedding cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()).slice(0, 10) // First 10 keys
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testEmbedding = await this.embed('test', { maxRetries: 1 });
      return testEmbedding.length > 0;
    } catch (error) {
      console.error('❌ Embedding service health check failed:', error);
      return false;
    }
  }
}

// ================== SINGLETON INSTANCE ==================

export const realEmbeddingService = new RealEmbeddingService({
  model: 'amazon.titan-embed-text-v1',
  dimensions: 1536,
  maxRetries: 3
});

console.log('🚀 Real Embedding Service instance created');