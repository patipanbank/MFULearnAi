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
exports.EmbeddingController = void 0;
const common_1 = require("@nestjs/common");
const embedding_service_1 = require("./embedding.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let EmbeddingController = class EmbeddingController {
    embeddingService;
    constructor(embeddingService) {
        this.embeddingService = embeddingService;
    }
    async createEmbedding(body) {
        try {
            const { text, modelId } = body;
            if (!text) {
                throw new common_1.HttpException('Text is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const embedding = await this.embeddingService.createEmbedding(text, modelId);
            return {
                success: true,
                data: { embedding },
                message: 'Embedding created successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create embedding: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createBatchEmbeddings(body) {
        try {
            const { texts, modelId } = body;
            if (!texts || !Array.isArray(texts) || texts.length === 0) {
                throw new common_1.HttpException('Texts array is required and cannot be empty', common_1.HttpStatus.BAD_REQUEST);
            }
            const embeddings = await this.embeddingService.createBatchEmbeddings(texts, modelId);
            return {
                success: true,
                data: { embeddings },
                message: 'Batch embeddings created successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create batch embeddings: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createImageEmbedding(body) {
        try {
            const { imageBase64, text, modelId } = body;
            if (!imageBase64) {
                throw new common_1.HttpException('Image base64 is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const embedding = await this.embeddingService.createImageEmbedding(imageBase64, text, modelId);
            return {
                success: true,
                data: { embedding },
                message: 'Image embedding created successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create image embedding: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async querySimilarDocuments(body) {
        try {
            const { collectionName, queryText, nResults = 5, modelId } = body;
            if (!collectionName) {
                throw new common_1.HttpException('Collection name is required', common_1.HttpStatus.BAD_REQUEST);
            }
            if (!queryText) {
                throw new common_1.HttpException('Query text is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const results = await this.embeddingService.querySimilarDocuments(collectionName, queryText, nResults, modelId);
            return {
                success: true,
                data: results,
                message: 'Similar documents queried successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to query similar documents: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async addDocumentsToCollection(body) {
        try {
            const { collectionName, documents, modelId } = body;
            if (!collectionName) {
                throw new common_1.HttpException('Collection name is required', common_1.HttpStatus.BAD_REQUEST);
            }
            if (!documents || !Array.isArray(documents) || documents.length === 0) {
                throw new common_1.HttpException('Documents array is required and cannot be empty', common_1.HttpStatus.BAD_REQUEST);
            }
            await this.embeddingService.addDocumentsToCollection(collectionName, documents, modelId);
            return {
                success: true,
                message: `Successfully added ${documents.length} documents to collection: ${collectionName}`,
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to add documents to collection: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async compareEmbeddings(body) {
        try {
            const { embedding1, embedding2 } = body;
            if (!embedding1 || !Array.isArray(embedding1)) {
                throw new common_1.HttpException('Embedding1 is required and must be an array', common_1.HttpStatus.BAD_REQUEST);
            }
            if (!embedding2 || !Array.isArray(embedding2)) {
                throw new common_1.HttpException('Embedding2 is required and must be an array', common_1.HttpStatus.BAD_REQUEST);
            }
            const similarity = await this.embeddingService.compareEmbeddings(embedding1, embedding2);
            return {
                success: true,
                data: { similarity },
                message: 'Embeddings compared successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to compare embeddings: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async validateEmbedding(body) {
        try {
            const { embedding } = body;
            if (!embedding) {
                throw new common_1.HttpException('Embedding is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const isValid = await this.embeddingService.validateEmbedding(embedding);
            return {
                success: true,
                data: { isValid },
                message: 'Embedding validation completed',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to validate embedding: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getModelDimension(body) {
        try {
            const { modelId } = body;
            if (!modelId) {
                throw new common_1.HttpException('Model ID is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const dimension = await this.embeddingService.getModelDimension(modelId);
            return {
                success: true,
                data: { dimension, modelId },
                message: 'Model dimension retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get model dimension: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.EmbeddingController = EmbeddingController;
__decorate([
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "createEmbedding", null);
__decorate([
    (0, common_1.Post)('batch'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "createBatchEmbeddings", null);
__decorate([
    (0, common_1.Post)('image'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "createImageEmbedding", null);
__decorate([
    (0, common_1.Post)('query'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "querySimilarDocuments", null);
__decorate([
    (0, common_1.Post)('add-to-collection'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "addDocumentsToCollection", null);
__decorate([
    (0, common_1.Post)('compare'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "compareEmbeddings", null);
__decorate([
    (0, common_1.Post)('validate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "validateEmbedding", null);
__decorate([
    (0, common_1.Post)('dimension'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmbeddingController.prototype, "getModelDimension", null);
exports.EmbeddingController = EmbeddingController = __decorate([
    (0, common_1.Controller)('embedding'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [embedding_service_1.EmbeddingService])
], EmbeddingController);
//# sourceMappingURL=embedding.controller.js.map