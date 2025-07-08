import { EmbeddingService } from './embedding.service';
import { ChromaService } from './chroma.service';
import { BedrockService } from '../infrastructure/bedrock/bedrock.service';
import { VectorSearchRequest, VectorSearchResponse } from '../common/schemas/embeddings.schemas';
export declare class VectorSearchService {
    private readonly embeddingService;
    private readonly chromaService;
    private readonly bedrockService;
    private readonly logger;
    constructor(embeddingService: EmbeddingService, chromaService: ChromaService, bedrockService: BedrockService);
    searchWithStrategy(request: VectorSearchRequest, strategy?: 'semantic' | 'hybrid' | 'contextual'): Promise<VectorSearchResponse>;
    batchSearch(queries: string[], collectionId: string, options: {
        topK: number;
        minSimilarity: number;
        strategy: 'semantic' | 'hybrid' | 'contextual';
    }): Promise<Map<string, VectorSearchResponse>>;
    expandQuery(originalQuery: string, expansionTerms?: number): Promise<{
        expandedQuery: string;
        terms: string[];
    }>;
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
    private sleep;
}
