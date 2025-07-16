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
var TrainingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const training_history_model_1 = require("../models/training-history.model");
const chroma_service_1 = require("../collection/chroma.service");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const document_service_1 = require("../upload/document.service");
const web_scraper_service_1 = require("../upload/web-scraper.service");
const config_service_1 = require("../config/config.service");
let TrainingService = TrainingService_1 = class TrainingService {
    trainingHistoryModel;
    chromaService;
    bedrockService;
    documentService;
    webScraperService;
    configService;
    logger = new common_1.Logger(TrainingService_1.name);
    CHUNK_SIZE = 1000;
    CHUNK_OVERLAP = 200;
    constructor(trainingHistoryModel, chromaService, bedrockService, documentService, webScraperService, configService) {
        this.trainingHistoryModel = trainingHistoryModel;
        this.chromaService = chromaService;
        this.bedrockService = bedrockService;
        this.documentService = documentService;
        this.webScraperService = webScraperService;
        this.configService = configService;
    }
    splitTextIntoChunks(text) {
        if (!text || !text.trim()) {
            return [];
        }
        const chunks = [];
        let currentChunk = '';
        const words = text.split(/\s+/);
        for (const word of words) {
            if ((currentChunk + ' ' + word).length > this.CHUNK_SIZE) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = word;
            }
            else {
                currentChunk += (currentChunk ? ' ' : '') + word;
            }
        }
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }
    async embedAndStore(text, sourceName, contentType, collectionName, userId, username, modelId) {
        if (!text || !text.trim()) {
            return 0;
        }
        const chunks = this.splitTextIntoChunks(text);
        if (!chunks.length) {
            return 0;
        }
        this.logger.log(`📝 Processing ${chunks.length} chunks for source: ${sourceName}`);
        const embeddings = await Promise.all(chunks.map(chunk => this.bedrockService.createTextEmbedding(chunk)));
        const validChunks = [];
        for (let i = 0; i < chunks.length; i++) {
            if (embeddings[i] && embeddings[i].length > 0) {
                validChunks.push({
                    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    document: chunks[i],
                    metadata: {
                        source_type: contentType,
                        source: sourceName,
                        uploadedBy: username || 'system',
                        userId: userId || 'system',
                        modelId: modelId,
                        collectionName: collectionName,
                    },
                    embedding: embeddings[i],
                });
            }
        }
        if (validChunks.length > 0) {
            await this.chromaService.addDocuments(collectionName, validChunks);
            this.logger.log(`✅ Added ${validChunks.length} documents to collection: ${collectionName}`);
        }
        return validChunks.length;
    }
    async uploadDocument(userId, username, collectionName, documentName, file, modelId) {
        try {
            this.logger.log(`📁 Uploading document ${documentName} to collection ${collectionName}`);
            const textContent = await this.documentService.parseFileContent(file.buffer, file.originalname);
            if (!textContent) {
                throw new Error('Could not extract text content from file');
            }
            const chunksCount = await this.embedAndStore(textContent, documentName, 'file', collectionName, userId, username, modelId);
            const history = new this.trainingHistoryModel({
                userId,
                username,
                collectionName,
                documentName,
                action: training_history_model_1.TrainingAction.UPLOAD,
                details: {
                    fileName: file.originalname,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    modelId,
                    chunks_added: chunksCount,
                    source_type: 'file',
                },
            });
            await history.save();
            return {
                success: true,
                message: 'Document uploaded successfully',
                documentName,
                collectionName,
                chunks: chunksCount,
            };
        }
        catch (error) {
            this.logger.error('Error uploading document:', error);
            throw error;
        }
    }
    async scrapeUrl(userId, username, collectionName, url, modelId) {
        try {
            this.logger.log(`🌐 Scraping URL ${url} for collection ${collectionName}`);
            const textContent = await this.webScraperService.scrapeUrl(url);
            if (!textContent) {
                throw new Error('Could not scrape any text from the URL');
            }
            const chunksCount = await this.embedAndStore(textContent, url, 'url', collectionName, userId, username, modelId);
            const history = new this.trainingHistoryModel({
                userId,
                username,
                collectionName,
                documentName: url,
                action: training_history_model_1.TrainingAction.UPLOAD,
                details: {
                    modelId,
                    chunks_added: chunksCount,
                    source_type: 'url',
                },
            });
            await history.save();
            return {
                success: true,
                message: 'URL scraped successfully',
                url,
                collectionName,
                chunks: chunksCount,
            };
        }
        catch (error) {
            this.logger.error('Error scraping URL:', error);
            throw error;
        }
    }
    async processText(userId, username, collectionName, documentName, text, modelId) {
        try {
            this.logger.log(`📝 Processing text ${documentName} for collection ${collectionName}`);
            const chunksCount = await this.embedAndStore(text, documentName, 'text', collectionName, userId, username, modelId);
            const history = new this.trainingHistoryModel({
                userId,
                username,
                collectionName,
                documentName,
                action: training_history_model_1.TrainingAction.UPLOAD,
                details: {
                    modelId,
                    chunks_added: chunksCount,
                    source_type: 'text',
                },
            });
            await history.save();
            return {
                success: true,
                message: 'Text processed successfully',
                documentName,
                collectionName,
                chunks: chunksCount,
            };
        }
        catch (error) {
            this.logger.error('Error processing text:', error);
            throw error;
        }
    }
    async deleteDocument(userId, username, collectionName, documentName) {
        try {
            this.logger.log(`🗑️ Deleting document ${documentName} from collection ${collectionName}`);
            await this.chromaService.deleteDocumentsBySource(collectionName, documentName);
            const history = new this.trainingHistoryModel({
                userId,
                username,
                collectionName,
                documentName,
                action: training_history_model_1.TrainingAction.DELETE,
                details: { document: documentName },
            });
            await history.save();
            return {
                success: true,
                message: 'Document deleted successfully',
                documentName,
                collectionName,
            };
        }
        catch (error) {
            this.logger.error('Error deleting document:', error);
            throw error;
        }
    }
    async createCollection(userId, username, collectionName, description) {
        try {
            this.logger.log(`📁 Creating collection ${collectionName}`);
            const history = new this.trainingHistoryModel({
                userId,
                username,
                collectionName,
                action: training_history_model_1.TrainingAction.CREATE_COLLECTION,
                details: { description },
            });
            await history.save();
            return {
                success: true,
                message: 'Collection created successfully',
                collectionName,
            };
        }
        catch (error) {
            this.logger.error('Error creating collection:', error);
            throw error;
        }
    }
    async updateCollection(userId, username, collectionName, updates) {
        try {
            this.logger.log(`✏️ Updating collection ${collectionName}`);
            const history = new this.trainingHistoryModel({
                userId,
                username,
                collectionName,
                action: training_history_model_1.TrainingAction.UPDATE_COLLECTION,
                details: updates,
            });
            await history.save();
            return {
                success: true,
                message: 'Collection updated successfully',
                collectionName,
            };
        }
        catch (error) {
            this.logger.error('Error updating collection:', error);
            throw error;
        }
    }
    async deleteCollection(userId, username, collectionName) {
        try {
            this.logger.log(`🗑️ Deleting collection ${collectionName}`);
            await this.chromaService.deleteCollection(collectionName);
            const history = new this.trainingHistoryModel({
                userId,
                username,
                collectionName,
                action: training_history_model_1.TrainingAction.DELETE_COLLECTION,
            });
            await history.save();
            return {
                success: true,
                message: 'Collection deleted successfully',
                collectionName,
            };
        }
        catch (error) {
            this.logger.error('Error deleting collection:', error);
            throw error;
        }
    }
    async getTrainingHistory(userId, limit = 50) {
        try {
            const history = await this.trainingHistoryModel
                .find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .exec();
            return history;
        }
        catch (error) {
            this.logger.error('Error getting training history:', error);
            return [];
        }
    }
    async getTrainingStats(userId) {
        try {
            const filter = userId ? { userId } : {};
            const stats = await this.trainingHistoryModel.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 },
                        totalChunks: { $sum: { $ifNull: ['$details.chunks_added', 0] } },
                    },
                },
            ]);
            return {
                totalActions: stats.reduce((sum, stat) => sum + stat.count, 0),
                totalChunks: stats.reduce((sum, stat) => sum + stat.totalChunks, 0),
                actionBreakdown: stats,
            };
        }
        catch (error) {
            this.logger.error('Error getting training stats:', error);
            return {
                totalActions: 0,
                totalChunks: 0,
                actionBreakdown: [],
            };
        }
    }
};
exports.TrainingService = TrainingService;
exports.TrainingService = TrainingService = TrainingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(training_history_model_1.TrainingHistory.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        chroma_service_1.ChromaService,
        bedrock_service_1.BedrockService,
        document_service_1.DocumentService,
        web_scraper_service_1.WebScraperService,
        config_service_1.ConfigService])
], TrainingService);
//# sourceMappingURL=training.service.js.map