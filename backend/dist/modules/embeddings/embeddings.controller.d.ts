import { EmbeddingService } from '../../services/embedding.service';
import { VectorSearchService } from '../../services/vector-search.service';
import { CacheService } from '../../services/cache.service';
import { BatchEmbeddingRequest, EmbeddingResponse, VectorSearchRequest, VectorSearchResponse, SemanticSimilarityRequest, SemanticSimilarityResponse, EmbeddingAnalytics, BatchProcessingJob } from '../../common/schemas/embeddings.schemas';
export declare class EmbeddingsController {
    private readonly embeddingService;
    private readonly vectorSearchService;
    private readonly cacheService;
    constructor(embeddingService: EmbeddingService, vectorSearchService: VectorSearchService, cacheService: CacheService);
    createBatchEmbeddings(request: BatchEmbeddingRequest): Promise<EmbeddingResponse>;
    vectorSearch(request: VectorSearchRequest): Promise<VectorSearchResponse>;
    hybridSearch(request: VectorSearchRequest): Promise<VectorSearchResponse>;
    contextualSearch(request: VectorSearchRequest): Promise<VectorSearchResponse>;
    batchSearch(request: {
        queries: string[];
        collectionId: string;
        options: {
            topK: number;
            minSimilarity: number;
            strategy: 'semantic' | 'hybrid' | 'contextual';
        };
    }): Promise<{
        results: Record<string, VectorSearchResponse>;
    }>;
    calculateSimilarity(request: SemanticSimilarityRequest): Promise<SemanticSimilarityResponse>;
    expandQuery(request: {
        query: string;
        expansionTerms?: number;
    }): Promise<{
        expandedQuery: string;
        terms: string[];
    }>;
    createBatchJob(request: {
        collectionId: string;
        texts: string[];
        jobType: 'embedding' | 'indexing' | 'reprocessing';
        submittedBy: string;
    }): Promise<BatchProcessingJob>;
    getBatchJobStatus(jobId: string): Promise<BatchProcessingJob | null>;
    getEmbeddingAnalytics(collectionId: string, startDate?: string, endDate?: string): Promise<EmbeddingAnalytics>;
    getSearchAnalytics(): Promise<{
        totalSearches: number;
        averageLatency: number;
        cacheHitRate: number;
        popularQueries: Array<{
            query: string;
            count: number;
        }>;
        searchTrends: any;
    }>;
    getCacheStats(): Promise<any>;
    optimizeCache(): Promise<{
        message: string;
    }>;
    clearCache(): Promise<{
        message: string;
    }>;
    healthCheck(): Promise<{
        status: string;
        timestamp: string;
        services: {
            embedding: string;
            search: string;
            cache: string;
        };
    }>;
    getSystemInfo(): Promise<{
        version: string;
        features: string[];
        models: string[];
        limitations: {
            maxBatchSize: number;
            maxTextLength: number;
            maxCacheSize: number;
            embeddingDimensions: number;
        };
    }>;
}
