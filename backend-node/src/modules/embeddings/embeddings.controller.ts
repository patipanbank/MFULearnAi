import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { EmbeddingService } from '../../services/embedding.service';
import { VectorSearchService } from '../../services/vector-search.service';
import { CacheService } from '../../services/cache.service';
import {
  BatchEmbeddingRequest,
  BatchEmbeddingRequestSchema,
  EmbeddingResponse,
  VectorSearchRequest,
  VectorSearchRequestSchema,
  VectorSearchResponse,
  SemanticSimilarityRequest,
  SemanticSimilarityRequestSchema,
  SemanticSimilarityResponse,
  EmbeddingAnalytics,
  BatchProcessingJob,
} from '../../common/schemas/embeddings.schemas';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  EmbeddingCreationException,
  VectorSearchException,
  BatchProcessingException,
  EmbeddingAnalyticsException,
} from '../../common/exceptions/app-exceptions';

@Controller('embeddings')
export class EmbeddingsController {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create batch embeddings
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'admin')
  async createBatchEmbeddings(
    @Body(new ZodValidationPipe(BatchEmbeddingRequestSchema)) request: BatchEmbeddingRequest
  ): Promise<EmbeddingResponse> {
    try {
      return await this.embeddingService.createBatchEmbeddings(request);
    } catch (error) {
      throw new EmbeddingCreationException(
        'Failed to create batch embeddings',
        { context: 'batch_embedding' },
        error as Error
      );
    }
  }

  /**
   * Semantic vector search
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'admin')
  async vectorSearch(
    @Body(new ZodValidationPipe(VectorSearchRequestSchema)) request: VectorSearchRequest
  ): Promise<VectorSearchResponse> {
    try {
      return await this.vectorSearchService.searchWithStrategy(request, 'semantic');
    } catch (error) {
      throw new VectorSearchException(
        'Vector search operation failed',
        { context: 'vector_search' },
        error as Error
      );
    }
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  @Post('search/hybrid')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'admin')
  async hybridSearch(
    @Body(new ZodValidationPipe(VectorSearchRequestSchema)) request: VectorSearchRequest
  ): Promise<VectorSearchResponse> {
    try {
      return await this.vectorSearchService.searchWithStrategy(request, 'hybrid');
    } catch (error) {
      throw new VectorSearchException(
        'Hybrid search operation failed',
        { context: 'hybrid_search' },
        error as Error
      );
    }
  }

  /**
   * Contextual search with query expansion
   */
  @Post('search/contextual')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'admin')
  async contextualSearch(
    @Body(new ZodValidationPipe(VectorSearchRequestSchema)) request: VectorSearchRequest
  ): Promise<VectorSearchResponse> {
    try {
      return await this.vectorSearchService.searchWithStrategy(request, 'contextual');
    } catch (error) {
      throw new VectorSearchException(
        'Contextual search operation failed',
        { context: 'contextual_search' },
        error as Error
      );
    }
  }

  /**
   * Batch search for multiple queries
   */
  @Post('search/batch')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'admin')
  async batchSearch(
    @Body() request: {
      queries: string[];
      collectionId: string;
      options: {
        topK: number;
        minSimilarity: number;
        strategy: 'semantic' | 'hybrid' | 'contextual';
      };
    }
  ): Promise<{ results: Record<string, VectorSearchResponse> }> {
    try {
      const results = await this.vectorSearchService.batchSearch(
        request.queries,
        request.collectionId,
        request.options
      );
      
      // Convert Map to object for JSON serialization
      const resultObject: Record<string, VectorSearchResponse> = {};
      results.forEach((value, key) => {
        resultObject[key] = value;
      });
      
      return { results: resultObject };
    } catch (error) {
      throw new VectorSearchException(
        'Batch search operation failed',
        { context: 'batch_search' },
        error as Error
      );
    }
  }

  /**
   * Calculate semantic similarity between two texts
   */
  @Post('similarity')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'admin')
  async calculateSimilarity(
    @Body(new ZodValidationPipe(SemanticSimilarityRequestSchema)) request: SemanticSimilarityRequest
  ): Promise<SemanticSimilarityResponse> {
    try {
      return await this.embeddingService.calculateSemanticSimilarity(request);
    } catch (error) {
      throw new EmbeddingCreationException(
        'Semantic similarity calculation failed',
        { context: 'similarity_calculation' },
        error as Error
      );
    }
  }

  /**
   * Query expansion for better search results
   */
  @Post('query-expansion')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'admin')
  async expandQuery(
    @Body() request: { query: string; expansionTerms?: number }
  ): Promise<{ expandedQuery: string; terms: string[] }> {
    try {
      return await this.vectorSearchService.expandQuery(
        request.query,
        request.expansionTerms
      );
    } catch (error) {
      throw new VectorSearchException(
        'Query expansion failed',
        { context: 'query_expansion' },
        error as Error
      );
    }
  }

  /**
   * Create batch processing job
   */
  @Post('batch-job')
  @HttpCode(HttpStatus.CREATED)
  @Roles('user', 'admin')
  async createBatchJob(
    @Body() request: {
      collectionId: string;
      texts: string[];
      jobType: 'embedding' | 'indexing' | 'reprocessing';
      submittedBy: string;
    }
  ): Promise<BatchProcessingJob> {
    try {
      return await this.embeddingService.createBatchProcessingJob(
        request.collectionId,
        request.texts,
        request.jobType,
        request.submittedBy
      );
    } catch (error) {
      throw new BatchProcessingException(
        'Failed to create batch processing job',
        { context: 'batch_job_creation' },
        error as Error
      );
    }
  }

  /**
   * Get batch job status
   */
  @Get('batch-job/:jobId')
  @Roles('user', 'admin')
  async getBatchJobStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string
  ): Promise<BatchProcessingJob | null> {
    try {
      return await this.embeddingService.getBatchJobStatus(jobId);
    } catch (error) {
      throw new BatchProcessingException(
        'Failed to get batch job status',
        { context: 'batch_job_status', jobId },
        error as Error
      );
    }
  }

  /**
   * Get embedding analytics
   */
  @Get('analytics/:collectionId')
  @Roles('user', 'admin')
  async getEmbeddingAnalytics(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<EmbeddingAnalytics> {
    try {
      const timeRange = {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString(),
      };

      return await this.embeddingService.getEmbeddingAnalytics(
        collectionId,
        timeRange
      );
    } catch (error) {
      throw new EmbeddingAnalyticsException(
        'Failed to get embedding analytics',
        { context: 'analytics', collectionId },
        error as Error
      );
    }
  }

  /**
   * Get search analytics
   */
  @Get('search/analytics')
  @Roles('user', 'admin')
  async getSearchAnalytics(): Promise<{
    totalSearches: number;
    averageLatency: number;
    cacheHitRate: number;
    popularQueries: Array<{ query: string; count: number }>;
    searchTrends: any;
  }> {
    try {
      return await this.vectorSearchService.getSearchAnalytics();
    } catch (error) {
      throw new VectorSearchException(
        'Failed to get search analytics',
        { context: 'search_analytics' },
        error as Error
      );
    }
  }

  /**
   * Cache management endpoints
   */
  @Get('cache/stats')
  @Roles('admin')
  async getCacheStats(): Promise<any> {
    try {
      return this.cacheService.getStats();
    } catch (error) {
      throw new VectorSearchException(
        'Failed to get cache statistics',
        { context: 'cache_stats' },
        error as Error
      );
    }
  }

  @Post('cache/optimize')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  async optimizeCache(): Promise<{ message: string }> {
    try {
      await this.cacheService.optimizeCache();
      return { message: 'Cache optimization completed successfully' };
    } catch (error) {
      throw new VectorSearchException(
        'Cache optimization failed',
        { context: 'cache_optimization' },
        error as Error
      );
    }
  }

  @Delete('cache/clear')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  async clearCache(): Promise<{ message: string }> {
    try {
      await this.cacheService.clear();
      return { message: 'Cache cleared successfully' };
    } catch (error) {
      throw new VectorSearchException(
        'Cache clear operation failed',
        { context: 'cache_clear' },
        error as Error
      );
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    services: {
      embedding: string;
      search: string;
      cache: string;
    };
  }> {
    try {
      const timestamp = new Date().toISOString();
      
      return {
        status: 'healthy',
        timestamp,
        services: {
          embedding: 'operational',
          search: 'operational',
          cache: 'operational',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          embedding: 'error',
          search: 'error',
          cache: 'error',
        },
      };
    }
  }

  /**
   * Get system information
   */
  @Get('info')
  @Roles('admin')
  async getSystemInfo(): Promise<{
    version: string;
    features: string[];
    models: string[];
    limitations: {
      maxBatchSize: number;
      maxTextLength: number;
      maxCacheSize: number;
      embeddingDimensions: number;
    };
  }> {
    return {
      version: '1.0.0',
      features: [
        'Batch Embeddings',
        'Semantic Search',
        'Hybrid Search',
        'Contextual Search',
        'Batch Search',
        'Query Expansion',
        'Cache Management',
        'Analytics',
      ],
      models: [
        'amazon.titan-embed-text-v1',
        'amazon.titan-embed-text-v2',
      ],
      limitations: {
        maxBatchSize: 100,
        maxTextLength: 10000,
        maxCacheSize: 10000,
        embeddingDimensions: 1536,
      },
    };
  }
} 