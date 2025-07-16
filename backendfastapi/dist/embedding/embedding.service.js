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
var EmbeddingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const common_1 = require("@nestjs/common");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const chroma_service_1 = require("../services/chroma.service");
let EmbeddingService = EmbeddingService_1 = class EmbeddingService {
    bedrockService;
    chromaService;
    logger = new common_1.Logger(EmbeddingService_1.name);
    constructor(bedrockService, chromaService) {
        this.bedrockService = bedrockService;
        this.chromaService = chromaService;
    }
    async createEmbedding(text, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`Creating embedding for text with model: ${modelId}`);
            const embedding = await this.bedrockService.createTextEmbedding(text);
            return embedding;
        }
        catch (error) {
            this.logger.error(`Error creating embedding: ${error}`);
            throw new Error(`Failed to create embedding: ${error.message}`);
        }
    }
    async createBatchEmbeddings(texts, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`Creating batch embeddings for ${texts.length} texts with model: ${modelId}`);
            const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
            return embeddings;
        }
        catch (error) {
            this.logger.error(`Error creating batch embeddings: ${error}`);
            throw new Error(`Failed to create batch embeddings: ${error.message}`);
        }
    }
    async createImageEmbedding(imageBase64, text, modelId = 'amazon.titan-embed-image-v1') {
        try {
            this.logger.log(`Creating image embedding with model: ${modelId}`);
            const embedding = await this.bedrockService.createImageEmbedding(imageBase64, text);
            return embedding;
        }
        catch (error) {
            this.logger.error(`Error creating image embedding: ${error}`);
            throw new Error(`Failed to create image embedding: ${error.message}`);
        }
    }
    async querySimilarDocuments(collectionName, queryText, nResults = 5, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`Querying similar documents in collection: ${collectionName}`);
            const queryEmbedding = await this.createEmbedding(queryText, modelId);
            const results = await this.chromaService.queryCollection(collectionName, [queryEmbedding], nResults);
            return results;
        }
        catch (error) {
            this.logger.error(`Error querying similar documents: ${error}`);
            throw new Error(`Failed to query similar documents: ${error.message}`);
        }
    }
    async addDocumentsToCollection(collectionName, documents, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`Adding ${documents.length} documents to collection: ${collectionName}`);
            const texts = documents.map(doc => doc.text);
            const embeddings = await this.createBatchEmbeddings(texts, modelId);
            const chromaDocuments = documents.map((doc, index) => ({
                id: doc.id || `doc_${Date.now()}_${index}`,
                document: doc.text,
                metadata: doc.metadata || {},
                embedding: embeddings[index],
            }));
            await this.chromaService.addDocuments(collectionName, chromaDocuments);
            this.logger.log(`Successfully added ${documents.length} documents to collection: ${collectionName}`);
        }
        catch (error) {
            this.logger.error(`Error adding documents to collection: ${error}`);
            throw new Error(`Failed to add documents to collection: ${error.message}`);
        }
    }
    async getModelDimension(modelId) {
        return this.bedrockService.getModelDimension(modelId);
    }
    async validateEmbedding(embedding) {
        try {
            if (!Array.isArray(embedding)) {
                return false;
            }
            if (embedding.length === 0) {
                return false;
            }
            return embedding.every(val => typeof val === 'number' && !isNaN(val));
        }
        catch (error) {
            this.logger.error(`Error validating embedding: ${error}`);
            return false;
        }
    }
    async compareEmbeddings(embedding1, embedding2) {
        try {
            if (embedding1.length !== embedding2.length) {
                throw new Error('Embeddings must have the same dimension');
            }
            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;
            for (let i = 0; i < embedding1.length; i++) {
                dotProduct += embedding1[i] * embedding2[i];
                norm1 += embedding1[i] * embedding1[i];
                norm2 += embedding2[i] * embedding2[i];
            }
            const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
            return similarity;
        }
        catch (error) {
            this.logger.error(`Error comparing embeddings: ${error}`);
            throw new Error(`Failed to compare embeddings: ${error.message}`);
        }
    }
};
exports.EmbeddingService = EmbeddingService;
exports.EmbeddingService = EmbeddingService = EmbeddingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService,
        chroma_service_1.ChromaService])
], EmbeddingService);
//# sourceMappingURL=embedding.service.js.map