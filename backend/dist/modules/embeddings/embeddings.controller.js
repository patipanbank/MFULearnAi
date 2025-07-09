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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingsController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/roles.decorator");
const embedding_service_1 = require("../../services/embedding.service");
const vector_search_service_1 = require("../../services/vector-search.service");
const cache_service_1 = require("../../services/cache.service");
const embeddings_schemas_1 = require("../../common/schemas/embeddings.schemas");
const zod_validation_pipe_1 = require("../../common/zod-validation.pipe");
const app_exceptions_1 = require("../../common/exceptions/app-exceptions");
let EmbeddingsController = class EmbeddingsController {
    constructor(embeddingService, vectorSearchService, cacheService) {
        this.embeddingService = embeddingService;
        this.vectorSearchService = vectorSearchService;
        this.cacheService = cacheService;
    }
    async createBatchEmbeddings(request) {
        try {
            return await this.embeddingService.createBatchEmbeddings(request);
        }
        catch (error) {
            throw new app_exceptions_1.EmbeddingCreationException('Failed to create batch embeddings', { context: 'batch_embedding' }, error);
        }
    }
    async vectorSearch(request) {
        try {
            return await this.vectorSearchService.searchWithStrategy(request, 'semantic');
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Vector search operation failed', { context: 'vector_search' }, error);
        }
    }
    async hybridSearch(request) {
        try {
            return await this.vectorSearchService.searchWithStrategy(request, 'hybrid');
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Hybrid search operation failed', { context: 'hybrid_search' }, error);
        }
    }
    async contextualSearch(request) {
        try {
            return await this.vectorSearchService.searchWithStrategy(request, 'contextual');
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Contextual search operation failed', { context: 'contextual_search' }, error);
        }
    }
    async batchSearch(request) {
        try {
            const results = await this.vectorSearchService.batchSearch(request.queries, request.collectionId, request.options);
            const resultObject = {};
            results.forEach((value, key) => {
                resultObject[key] = value;
            });
            return { results: resultObject };
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Batch search operation failed', { context: 'batch_search' }, error);
        }
    }
    async calculateSimilarity(request) {
        try {
            return await this.embeddingService.calculateSemanticSimilarity(request);
        }
        catch (error) {
            throw new app_exceptions_1.EmbeddingCreationException('Semantic similarity calculation failed', { context: 'similarity_calculation' }, error);
        }
    }
    async expandQuery(request) {
        try {
            return await this.vectorSearchService.expandQuery(request.query, request.expansionTerms);
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Query expansion failed', { context: 'query_expansion' }, error);
        }
    }
    async createBatchJob(request) {
        try {
            return await this.embeddingService.createBatchProcessingJob(request.collectionId, request.texts, request.jobType, request.submittedBy);
        }
        catch (error) {
            throw new app_exceptions_1.BatchProcessingException('Failed to create batch processing job', { context: 'batch_job_creation' }, error);
        }
    }
    async getBatchJobStatus(jobId) {
        try {
            return await this.embeddingService.getBatchJobStatus(jobId);
        }
        catch (error) {
            throw new app_exceptions_1.BatchProcessingException('Failed to get batch job status', { context: 'batch_job_status', jobId }, error);
        }
    }
    async getEmbeddingAnalytics(collectionId, startDate, endDate) {
        try {
            const timeRange = {
                start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: endDate || new Date().toISOString(),
            };
            return await this.embeddingService.getEmbeddingAnalytics(collectionId, timeRange);
        }
        catch (error) {
            throw new app_exceptions_1.EmbeddingAnalyticsException('Failed to get embedding analytics', { context: 'analytics', collectionId }, error);
        }
    }
    async getSearchAnalytics() {
        try {
            return await this.vectorSearchService.getSearchAnalytics();
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Failed to get search analytics', { context: 'search_analytics' }, error);
        }
    }
    async getCacheStats() {
        try {
            return this.cacheService.getStats();
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Failed to get cache statistics', { context: 'cache_stats' }, error);
        }
    }
    async optimizeCache() {
        try {
            await this.cacheService.optimizeCache();
            return { message: 'Cache optimization completed successfully' };
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Cache optimization failed', { context: 'cache_optimization' }, error);
        }
    }
    async clearCache() {
        try {
            await this.cacheService.clear();
            return { message: 'Cache cleared successfully' };
        }
        catch (error) {
            throw new app_exceptions_1.VectorSearchException('Cache clear operation failed', { context: 'cache_clear' }, error);
        }
    }
    async healthCheck() {
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
        }
        catch (error) {
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
    async getSystemInfo() {
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
};
exports.EmbeddingsController = EmbeddingsController;
__decorate([
    (0, common_1.Post)('batch'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(embeddings_schemas_1.BatchEmbeddingRequestSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "createBatchEmbeddings", null);
__decorate([
    (0, common_1.Post)('search'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(embeddings_schemas_1.VectorSearchRequestSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "vectorSearch", null);
__decorate([
    (0, common_1.Post)('search/hybrid'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(embeddings_schemas_1.VectorSearchRequestSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "hybridSearch", null);
__decorate([
    (0, common_1.Post)('search/contextual'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(embeddings_schemas_1.VectorSearchRequestSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "contextualSearch", null);
__decorate([
    (0, common_1.Post)('search/batch'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "batchSearch", null);
__decorate([
    (0, common_1.Post)('similarity'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(embeddings_schemas_1.SemanticSimilarityRequestSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "calculateSimilarity", null);
__decorate([
    (0, common_1.Post)('query-expansion'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "expandQuery", null);
__decorate([
    (0, common_1.Post)('batch-job'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "createBatchJob", null);
__decorate([
    (0, common_1.Get)('batch-job/:jobId'),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Param)('jobId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "getBatchJobStatus", null);
__decorate([
    (0, common_1.Get)('analytics/:collectionId'),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __param(0, (0, common_1.Param)('collectionId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "getEmbeddingAnalytics", null);
__decorate([
    (0, common_1.Get)('search/analytics'),
    (0, roles_decorator_1.Roles)('user', 'admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "getSearchAnalytics", null);
__decorate([
    (0, common_1.Get)('cache/stats'),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "getCacheStats", null);
__decorate([
    (0, common_1.Post)('cache/optimize'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "optimizeCache", null);
__decorate([
    (0, common_1.Delete)('cache/clear'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "clearCache", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "healthCheck", null);
__decorate([
    (0, common_1.Get)('info'),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmbeddingsController.prototype, "getSystemInfo", null);
exports.EmbeddingsController = EmbeddingsController = __decorate([
    (0, common_1.Controller)({
        path: 'embeddings',
        version: '1'
    }),
    __metadata("design:paramtypes", [embedding_service_1.EmbeddingService,
        vector_search_service_1.VectorSearchService,
        cache_service_1.CacheService])
], EmbeddingsController);
//# sourceMappingURL=embeddings.controller.js.map