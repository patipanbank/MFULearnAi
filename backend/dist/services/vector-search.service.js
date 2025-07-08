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
var VectorSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearchService = void 0;
const common_1 = require("@nestjs/common");
const embedding_service_1 = require("./embedding.service");
const chroma_service_1 = require("./chroma.service");
const bedrock_service_1 = require("../infrastructure/bedrock/bedrock.service");
const app_exceptions_1 = require("../common/exceptions/app-exceptions");
let VectorSearchService = VectorSearchService_1 = class VectorSearchService {
    constructor(embeddingService, chromaService, bedrockService) {
        this.embeddingService = embeddingService;
        this.chromaService = chromaService;
        this.bedrockService = bedrockService;
        this.logger = new common_1.Logger(VectorSearchService_1.name);
    }
    async searchWithStrategy(request, strategy = 'semantic') {
        try {
            this.logger.log(`🔍 Starting ${strategy} search for: "${request.query}"`);
            return await this.embeddingService.searchVectors(request);
        }
        catch (error) {
            this.logger.error(`❌ Vector search failed: ${error}`);
            throw new app_exceptions_1.VectorSearchException('Advanced vector search failed', { context: 'search_strategy' }, error);
        }
    }
    async batchSearch(queries, collectionId, options) {
        try {
            this.logger.log(`📋 Batch search for ${queries.length} queries`);
            const results = new Map();
            for (const query of queries) {
                const request = {
                    query,
                    collectionId,
                    topK: options.topK,
                    minSimilarity: options.minSimilarity,
                    includeMetadata: true,
                    includeEmbeddings: false,
                };
                const result = await this.searchWithStrategy(request, options.strategy);
                results.set(query, result);
                await this.sleep(100);
            }
            this.logger.log(`✅ Batch search completed`);
            return results;
        }
        catch (error) {
            this.logger.error(`❌ Batch search failed: ${error}`);
            throw new app_exceptions_1.VectorSearchException('Batch search operation failed', { context: 'batch_search' }, error);
        }
    }
    async expandQuery(originalQuery, expansionTerms = 5) {
        try {
            this.logger.debug(`🔍 Expanding query: "${originalQuery}"`);
            const commonExpansions = [
                'related', 'similar', 'about', 'regarding', 'concerning',
                'topic', 'subject', 'matter', 'information', 'details'
            ];
            const semanticTerms = commonExpansions.slice(0, expansionTerms);
            const expandedQuery = [originalQuery, ...semanticTerms].join(' ');
            this.logger.debug(`✅ Query expanded with ${semanticTerms.length} terms`);
            return { expandedQuery, terms: semanticTerms };
        }
        catch (error) {
            this.logger.error(`❌ Query expansion failed: ${error}`);
            return { expandedQuery: originalQuery, terms: [] };
        }
    }
    async getSearchAnalytics() {
        try {
            return {
                totalSearches: 1000,
                averageLatency: 25,
                cacheHitRate: 0.75,
                popularQueries: [
                    { query: 'machine learning', count: 150 },
                    { query: 'artificial intelligence', count: 120 },
                    { query: 'data science', count: 100 },
                ],
                searchTrends: {
                    dailySearches: [100, 120, 110, 130, 140],
                    topCollections: ['col1', 'col2', 'col3'],
                },
            };
        }
        catch (error) {
            this.logger.error(`❌ Failed to get search analytics: ${error}`);
            throw new app_exceptions_1.VectorSearchException('Failed to retrieve search analytics', { context: 'analytics' }, error);
        }
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
exports.VectorSearchService = VectorSearchService;
exports.VectorSearchService = VectorSearchService = VectorSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [embedding_service_1.EmbeddingService,
        chroma_service_1.ChromaService,
        bedrock_service_1.BedrockService])
], VectorSearchService);
//# sourceMappingURL=vector-search.service.js.map