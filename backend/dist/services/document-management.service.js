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
var DocumentManagementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentManagementService = void 0;
const common_1 = require("@nestjs/common");
const bedrock_service_1 = require("../infrastructure/bedrock/bedrock.service");
const chroma_service_1 = require("./chroma.service");
const document_service_1 = require("./document.service");
const uuid_1 = require("uuid");
let DocumentManagementService = DocumentManagementService_1 = class DocumentManagementService {
    constructor(bedrockService, chromaService, documentService) {
        this.bedrockService = bedrockService;
        this.chromaService = chromaService;
        this.documentService = documentService;
        this.logger = new common_1.Logger(DocumentManagementService_1.name);
        this.maxChunkSize = 1000;
        this.chunkOverlap = 100;
        this.supportedFormats = ['.txt', '.pdf', '.md', '.csv', '.json'];
    }
    async uploadDocument(collectionId, file, userId) {
        const documentId = (0, uuid_1.v4)();
        const startTime = Date.now();
        this.logger.log(`📄 Starting document upload: ${file.originalname} to collection: ${collectionId}`);
        try {
            this.validateFile(file);
            const textContent = await this.extractTextContent(file);
            if (!textContent || textContent.trim().length === 0) {
                throw new common_1.BadRequestException('No text content found in document');
            }
            const chunks = this.splitIntoChunks(textContent, {
                documentId,
                collectionId,
                filename: file.originalname,
                uploadedBy: userId,
                fileType: this.getFileType(file.originalname),
                fileSize: file.size
            });
            this.logger.log(`📋 Created ${chunks.length} chunks from document: ${file.originalname}`);
            const chunksWithEmbeddings = await this.createEmbeddingsForChunks(chunks);
            await this.storeChunksInVectorDB(collectionId, chunksWithEmbeddings);
            const processingTime = Date.now() - startTime;
            this.logger.log(`✅ Document processed successfully in ${processingTime}ms: ${file.originalname}`);
            return {
                documentId,
                filename: file.originalname,
                totalChunks: chunks.length,
                totalCharacters: textContent.length,
                status: 'completed'
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Document processing failed: ${errorMessage}`);
            return {
                documentId,
                filename: file.originalname,
                totalChunks: 0,
                totalCharacters: 0,
                status: 'failed',
                message: errorMessage
            };
        }
    }
    async searchDocuments(collectionId, query, limit = 10, minSimilarity = 0.7) {
        const startTime = Date.now();
        try {
            this.logger.debug(`🔍 Searching collection ${collectionId} for: "${query}"`);
            const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                throw new Error('Failed to create query embedding');
            }
            const searchResults = await this.chromaService.queryCollection(this.getCollectionName(collectionId), queryEmbedding, limit);
            if (!searchResults) {
                return {
                    chunks: [],
                    totalResults: 0,
                    searchTime: Date.now() - startTime
                };
            }
            const chunks = this.convertSearchResultsToChunks(searchResults, minSimilarity);
            const searchTime = Date.now() - startTime;
            this.logger.debug(`🎯 Found ${chunks.length} relevant chunks in ${searchTime}ms`);
            return {
                chunks,
                totalResults: chunks.length,
                searchTime
            };
        }
        catch (error) {
            this.logger.error(`Search failed for collection ${collectionId}: ${error}`);
            return {
                chunks: [],
                totalResults: 0,
                searchTime: Date.now() - startTime
            };
        }
    }
    async getDocuments(collectionId, limit = 50) {
        try {
            const collectionName = this.getCollectionName(collectionId);
            const results = await this.chromaService.getDocuments(collectionName, limit);
            if (!(results === null || results === void 0 ? void 0 : results.documents) || !(results === null || results === void 0 ? void 0 : results.metadatas)) {
                return [];
            }
            return results.documents.map((doc, index) => {
                var _a;
                return ({
                    id: results.ids[index],
                    collectionId,
                    documentId: String(((_a = results.metadatas[index]) === null || _a === void 0 ? void 0 : _a.documentId) || ''),
                    text: doc || '',
                    metadata: results.metadatas[index]
                });
            });
        }
        catch (error) {
            this.logger.error(`Failed to get documents for collection ${collectionId}: ${error}`);
            return [];
        }
    }
    async deleteDocument(collectionId, documentId) {
        try {
            const collectionName = this.getCollectionName(collectionId);
            const allChunks = await this.chromaService.getDocuments(collectionName, 1000);
            if (!(allChunks === null || allChunks === void 0 ? void 0 : allChunks.ids) || !(allChunks === null || allChunks === void 0 ? void 0 : allChunks.metadatas)) {
                return;
            }
            const chunkIdsToDelete = allChunks.ids.filter((id, index) => {
                const metadata = allChunks.metadatas[index];
                return (metadata === null || metadata === void 0 ? void 0 : metadata.documentId) === documentId;
            });
            if (chunkIdsToDelete.length > 0) {
                await this.chromaService.deleteDocuments(collectionName, chunkIdsToDelete);
                this.logger.log(`🗑️ Deleted ${chunkIdsToDelete.length} chunks for document: ${documentId}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to delete document ${documentId}: ${error}`);
            throw error;
        }
    }
    async getCollectionStats(collectionId) {
        try {
            const collectionName = this.getCollectionName(collectionId);
            const documents = await this.chromaService.getDocuments(collectionName, 1000);
            if (!(documents === null || documents === void 0 ? void 0 : documents.metadatas)) {
                return {
                    totalDocuments: 0,
                    totalChunks: 0,
                    averageChunkSize: 0,
                    uniqueFileTypes: []
                };
            }
            const documentIds = new Set();
            const fileTypes = new Set();
            let totalCharacters = 0;
            documents.metadatas.forEach(metadata => {
                if (metadata === null || metadata === void 0 ? void 0 : metadata.documentId) {
                    documentIds.add(String(metadata.documentId));
                }
                if ((metadata === null || metadata === void 0 ? void 0 : metadata.fileType) && typeof metadata.fileType === 'string') {
                    fileTypes.add(metadata.fileType);
                }
                if ((metadata === null || metadata === void 0 ? void 0 : metadata.characters) && typeof metadata.characters === 'number') {
                    totalCharacters += metadata.characters;
                }
            });
            return {
                totalDocuments: documentIds.size,
                totalChunks: documents.metadatas.length,
                averageChunkSize: documents.metadatas.length > 0 ?
                    Math.round(totalCharacters / documents.metadatas.length) : 0,
                uniqueFileTypes: Array.from(fileTypes)
            };
        }
        catch (error) {
            this.logger.error(`Failed to get stats for collection ${collectionId}: ${error}`);
            return {
                totalDocuments: 0,
                totalChunks: 0,
                averageChunkSize: 0,
                uniqueFileTypes: []
            };
        }
    }
    validateFile(file) {
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new common_1.BadRequestException('File size too large (max 10MB)');
        }
        const fileExtension = this.getFileType(file.originalname);
        if (!this.supportedFormats.includes(fileExtension)) {
            throw new common_1.BadRequestException(`Unsupported file format. Supported formats: ${this.supportedFormats.join(', ')}`);
        }
    }
    async extractTextContent(file) {
        return this.documentService.parseFileContent(file.buffer, file.originalname);
    }
    splitIntoChunks(text, baseMetadata) {
        const chunks = [];
        const paragraphs = text.split(/\n\s*\n/);
        let currentChunk = '';
        let chunkIndex = 0;
        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
            if (!trimmedParagraph)
                continue;
            if (currentChunk.length + trimmedParagraph.length > this.maxChunkSize && currentChunk.length > 0) {
                chunks.push(this.createChunk(currentChunk, chunkIndex, baseMetadata));
                const words = currentChunk.split(' ');
                const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 6));
                currentChunk = overlapWords.join(' ') + ' ';
                chunkIndex++;
            }
            currentChunk += trimmedParagraph + '\n\n';
        }
        if (currentChunk.trim().length > 0) {
            chunks.push(this.createChunk(currentChunk, chunkIndex, baseMetadata));
        }
        return chunks.map(chunk => ({
            ...chunk,
            metadata: {
                ...chunk.metadata,
                totalChunks: chunks.length
            }
        }));
    }
    createChunk(text, chunkIndex, baseMetadata) {
        return {
            id: (0, uuid_1.v4)(),
            collectionId: baseMetadata.collectionId || '',
            documentId: baseMetadata.documentId || '',
            text: text.trim(),
            metadata: {
                filename: baseMetadata.filename || '',
                chunkIndex,
                totalChunks: 0,
                characters: text.trim().length,
                uploadedBy: baseMetadata.uploadedBy || '',
                uploadedAt: new Date(),
                fileType: baseMetadata.fileType || '',
                fileSize: baseMetadata.fileSize || 0,
                ...baseMetadata
            }
        };
    }
    async createEmbeddingsForChunks(chunks) {
        this.logger.debug(`🤖 Creating embeddings for ${chunks.length} chunks`);
        const batchSize = 5;
        const processedChunks = [];
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const texts = batch.map(chunk => chunk.text);
            try {
                const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
                for (let j = 0; j < batch.length; j++) {
                    processedChunks.push({
                        ...batch[j],
                        embedding: embeddings[j]
                    });
                }
            }
            catch (error) {
                this.logger.warn(`Failed to create embeddings for batch ${i}: ${error}`);
                processedChunks.push(...batch);
            }
            if (i + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        const successfulEmbeddings = processedChunks.filter(chunk => chunk.embedding).length;
        this.logger.debug(`✅ Created ${successfulEmbeddings}/${chunks.length} embeddings`);
        return processedChunks;
    }
    async storeChunksInVectorDB(collectionId, chunks) {
        const collectionName = this.getCollectionName(collectionId);
        const validChunks = chunks.filter(chunk => chunk.embedding && chunk.embedding.length > 0);
        if (validChunks.length === 0) {
            throw new Error('No valid chunks with embeddings to store');
        }
        const chromaDocuments = validChunks.map(chunk => ({
            id: chunk.id,
            text: chunk.text,
            embedding: chunk.embedding,
            metadata: {
                ...chunk.metadata,
                documentId: chunk.documentId,
                collectionId: chunk.collectionId
            }
        }));
        await this.chromaService.addDocuments(collectionName, chromaDocuments);
    }
    convertSearchResultsToChunks(searchResults, minSimilarity) {
        var _a, _b, _c;
        if (!searchResults.documents || !searchResults.metadatas || !searchResults.distances) {
            return [];
        }
        const documents = searchResults.documents[0] || [];
        const metadatas = searchResults.metadatas[0] || [];
        const distances = searchResults.distances[0] || [];
        const chunks = [];
        for (let i = 0; i < documents.length; i++) {
            const similarity = 1 - distances[i];
            if (similarity >= minSimilarity) {
                chunks.push({
                    id: ((_a = metadatas[i]) === null || _a === void 0 ? void 0 : _a.id) || `chunk_${i}`,
                    collectionId: ((_b = metadatas[i]) === null || _b === void 0 ? void 0 : _b.collectionId) || '',
                    documentId: ((_c = metadatas[i]) === null || _c === void 0 ? void 0 : _c.documentId) || '',
                    text: documents[i],
                    metadata: metadatas[i] || {}
                });
            }
        }
        return chunks;
    }
    getCollectionName(collectionId) {
        return `documents_${collectionId}`;
    }
    getFileType(filename) {
        const parts = filename.toLowerCase().split('.');
        return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
    }
};
exports.DocumentManagementService = DocumentManagementService;
exports.DocumentManagementService = DocumentManagementService = DocumentManagementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService,
        chroma_service_1.ChromaService,
        document_service_1.DocumentService])
], DocumentManagementService);
//# sourceMappingURL=document-management.service.js.map