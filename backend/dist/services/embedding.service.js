"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EmbeddingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const common_1 = require("@nestjs/common");
const bedrock_service_1 = require("../infrastructure/bedrock/bedrock.service");
const chroma_service_1 = require("./chroma.service");
const common_2 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const uuid_1 = require("uuid");
const embeddings_schemas_1 = require("../common/schemas/embeddings.schemas");
const app_exceptions_1 = require("../common/exceptions/app-exceptions");
let EmbeddingService = EmbeddingService_1 = class EmbeddingService {
    constructor(bedrockService, chromaService, redis) {
        this.bedrockService = bedrockService;
        this.chromaService = chromaService;
        this.redis = redis;
        this.logger = new common_1.Logger(EmbeddingService_1.name);
    }
    async createBatchEmbeddings(request) {
        var _a;
        const startTime = Date.now();
        try {
            const validatedRequest = embeddings_schemas_1.BatchEmbeddingRequestSchema.parse(request);
            this.logger.log(`🔄 Creating embeddings for ${validatedRequest.texts.length} texts`);
            const embeddings = await this.bedrockService.createBatchTextEmbeddings(validatedRequest.texts);
            const validEmbeddings = embeddings.filter(embedding => embedding && embedding.length > 0);
            const processingTime = Date.now() - startTime;
            const failedCount = validatedRequest.texts.length - validEmbeddings.length;
            const response = {
                success: true,
                embeddings: validEmbeddings,
                processedTexts: validatedRequest.texts.slice(0, validEmbeddings.length),
                metadata: {
                    totalTexts: validatedRequest.texts.length,
                    processedCount: validEmbeddings.length,
                    failedCount,
                    processingTime,
                    modelId: validatedRequest.modelId,
                    embeddingDimensions: ((_a = validEmbeddings[0]) === null || _a === void 0 ? void 0 : _a.length) || 0,
                },
            };
            return response;
        }
        catch (error) {
            this.logger.error(`❌ Batch embedding creation failed: ${error}`);
            throw new app_exceptions_1.EmbeddingCreationException('Failed to create embeddings', { context: 'batch_embedding' }, error);
        }
    }
    async searchVectors(request) {
        const startTime = Date.now();
        try {
            const validatedRequest = embeddings_schemas_1.VectorSearchRequestSchema.parse(request);
            this.logger.log(`🔍 Searching vectors in collection: ${validatedRequest.collectionId}`);
            const queryEmbedding = await this.bedrockService.createTextEmbedding(validatedRequest.query);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                throw new app_exceptions_1.EmbeddingCreationException('Failed to create query embedding', { context: 'query_embedding' });
            }
            const collectionName = this.getCollectionName(validatedRequest.collectionId);
            const searchResults = await this.chromaService.queryCollection(collectionName, queryEmbedding, validatedRequest.topK);
            const processedResults = this.processSearchResults(searchResults, validatedRequest.minSimilarity);
            const searchTime = Date.now() - startTime;
            this.logger.log(`✅ Found ${processedResults.length} relevant results in ${searchTime}ms`);
            const response = {
                results: processedResults,
                query: validatedRequest.query,
                searchMetadata: {
                    totalResults: processedResults.length,
                    searchTime,
                    collectionId: validatedRequest.collectionId,
                    queryEmbedding: validatedRequest.includeEmbeddings ? queryEmbedding : undefined,
                    appliedFilters: validatedRequest.filters,
                },
            };
            return response;
        }
        catch (error) {
            this.logger.error(`❌ Vector search failed: ${error}`);
            throw new app_exceptions_1.VectorSearchException('Vector search operation failed', { context: 'vector_search' }, error);
        }
    }
    async calculateSemanticSimilarity(request) {
        const startTime = Date.now();
        try {
            const validatedRequest = embeddings_schemas_1.SemanticSimilarityRequestSchema.parse(request);
            this.logger.debug(`📊 Calculating similarity between texts`);
            const [embedding1, embedding2] = await Promise.all([
                this.bedrockService.createTextEmbedding(validatedRequest.text1),
                this.bedrockService.createTextEmbedding(validatedRequest.text2),
            ]);
            if (!embedding1.length || !embedding2.length) {
                throw new app_exceptions_1.EmbeddingCreationException('Failed to create embeddings for similarity calculation', { context: 'similarity_calculation' });
            }
            const similarity = this.calculateSimilarity(embedding1, embedding2, validatedRequest.similarityFunction);
            const processingTime = Date.now() - startTime;
            const response = {
                similarity,
                text1: validatedRequest.text1,
                text2: validatedRequest.text2,
                embeddings: {
                    text1: embedding1,
                    text2: embedding2,
                },
                metadata: {
                    modelId: validatedRequest.modelId,
                    processingTime,
                    similarityFunction: validatedRequest.similarityFunction,
                },
            };
            return response;
        }
        catch (error) {
            this.logger.error(`❌ Semantic similarity calculation failed: ${error}`);
            throw new app_exceptions_1.EmbeddingCreationException('Failed to calculate semantic similarity', { context: 'similarity_calculation' }, error);
        }
    }
    async getEmbeddingAnalytics(collectionId, timeRange) {
        try {
            this.logger.log(`📈 Generating analytics for collection: ${collectionId}`);
            const analytics = {
                collectionId,
                timeRange,
                metrics: {
                    totalEmbeddings: 1000,
                    averageEmbeddingTime: 150,
                    totalProcessingTime: 15000,
                    embeddingSuccessRate: 0.95,
                    averageTextLength: 150,
                    topDocumentTypes: [
                        { type: 'pdf', count: 500, percentage: 50 },
                        { type: 'txt', count: 300, percentage: 30 },
                        { type: 'md', count: 200, percentage: 20 },
                    ],
                    embeddingQuality: {
                        averageSimilarity: 0.85,
                        varianceScore: 0.15,
                        clusteringCoherence: 0.80,
                    },
                },
                performance: {
                    searchLatency: 25,
                    embeddingLatency: 100,
                    storageEfficiency: 0.92,
                    cacheHitRate: 0.75,
                },
            };
            return analytics;
        }
        catch (error) {
            this.logger.error(`❌ Analytics generation failed: ${error}`);
            throw new app_exceptions_1.EmbeddingAnalyticsException('Failed to generate embedding analytics', { context: 'analytics' }, error);
        }
    }
    async createBatchProcessingJob(collectionId, texts, jobType, submittedBy) {
        const jobId = (0, uuid_1.v4)();
        try {
            this.logger.log(`🚀 Creating batch processing job: ${jobId}`);
            const job = {
                jobId,
                collectionId,
                status: 'pending',
                progress: {
                    totalItems: texts.length,
                    processedItems: 0,
                    failedItems: 0,
                    percentage: 0,
                },
                metadata: {
                    createdAt: new Date().toISOString(),
                    submittedBy,
                    jobType,
                },
            };
            await this.redis.setex(`batch_job:${jobId}`, 24 * 60 * 60, JSON.stringify(job));
            return job;
        }
        catch (error) {
            this.logger.error(`❌ Batch job creation failed: ${error}`);
            throw new app_exceptions_1.BatchProcessingException('Failed to create batch processing job', { context: 'batch_job' }, error);
        }
    }
    async getBatchJobStatus(jobId) {
        try {
            const jobData = await this.redis.get(`batch_job:${jobId}`);
            return jobData ? JSON.parse(jobData) : null;
        }
        catch (error) {
            this.logger.error(`❌ Failed to get batch job status: ${error}`);
            return null;
        }
    }
    processSearchResults(searchResults, minSimilarity) {
        var _a, _b, _c;
        if (!searchResults || !searchResults.documents || !searchResults.documents[0]) {
            return [];
        }
        const documents = searchResults.documents[0];
        const metadatas = ((_a = searchResults.metadatas) === null || _a === void 0 ? void 0 : _a[0]) || [];
        const distances = ((_b = searchResults.distances) === null || _b === void 0 ? void 0 : _b[0]) || [];
        const ids = ((_c = searchResults.ids) === null || _c === void 0 ? void 0 : _c[0]) || [];
        const results = documents.map((doc, index) => {
            const similarity = this.distanceToSimilarity(distances[index] || 0);
            return {
                document: {
                    id: ids[index],
                    text: doc,
                    embedding: [],
                    metadata: metadatas[index] || {},
                    similarity,
                },
                similarity,
                rank: index + 1,
            };
        });
        return results.filter(result => result.similarity >= minSimilarity);
    }
    calculateSimilarity(vec1, vec2, function_type) {
        switch (function_type) {
            case 'cosine':
                return this.cosineSimilarity(vec1, vec2);
            case 'euclidean':
                return 1 / (1 + this.euclideanDistance(vec1, vec2));
            case 'dot':
                return this.dotProduct(vec1, vec2);
            default:
                return this.cosineSimilarity(vec1, vec2);
        }
    }
    cosineSimilarity(vec1, vec2) {
        const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
        const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
        const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (norm1 * norm2);
    }
    euclideanDistance(vec1, vec2) {
        return Math.sqrt(vec1.reduce((sum, val, i) => sum + Math.pow(val - vec2[i], 2), 0));
    }
    dotProduct(vec1, vec2) {
        return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    }
    distanceToSimilarity(distance) {
        return Math.max(0, 1 - distance);
    }
    getCollectionName(collectionId) {
        return `embeddings_${collectionId}`;
    }
};
exports.EmbeddingService = EmbeddingService;
exports.EmbeddingService = EmbeddingService = EmbeddingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService,
        chroma_service_1.ChromaService,
        ioredis_1.Redis])
], EmbeddingService);
//# sourceMappingURL=embedding.service.js.map