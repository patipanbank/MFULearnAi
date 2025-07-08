import { BedrockService } from '../infrastructure/bedrock/bedrock.service';
import { ChromaService } from './chroma.service';
import { Redis } from 'ioredis';
import { BatchEmbeddingRequest, EmbeddingResponse, VectorSearchRequest, VectorSearchResponse, SemanticSimilarityRequest, SemanticSimilarityResponse, EmbeddingAnalytics, BatchProcessingJob } from '../common/schemas/embeddings.schemas';
export declare class EmbeddingService {
    private readonly bedrockService;
    private readonly chromaService;
    private readonly redis;
    private readonly logger;
    constructor(bedrockService: BedrockService, chromaService: ChromaService, redis: Redis);
    createBatchEmbeddings(request: BatchEmbeddingRequest): Promise<EmbeddingResponse>;
    searchVectors(request: VectorSearchRequest): Promise<VectorSearchResponse>;
    calculateSemanticSimilarity(request: SemanticSimilarityRequest): Promise<SemanticSimilarityResponse>;
    getEmbeddingAnalytics(collectionId: string, timeRange: {
        start: string;
        end: string;
    }): Promise<EmbeddingAnalytics>;
    createBatchProcessingJob(collectionId: string, texts: string[], jobType: 'embedding' | 'indexing' | 'reprocessing', submittedBy: string): Promise<BatchProcessingJob>;
    getBatchJobStatus(jobId: string): Promise<BatchProcessingJob | null>;
    private processSearchResults;
    private calculateSimilarity;
    private cosineSimilarity;
    private euclideanDistance;
    private dotProduct;
    private distanceToSimilarity;
    private getCollectionName;
}
