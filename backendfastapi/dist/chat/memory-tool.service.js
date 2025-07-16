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
var MemoryToolService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryToolService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const chroma_service_1 = require("../collection/chroma.service");
let MemoryToolService = MemoryToolService_1 = class MemoryToolService {
    configService;
    bedrockService;
    chromaService;
    logger = new common_1.Logger(MemoryToolService_1.name);
    MAX_DOCUMENTS_PER_COLLECTION = 1000;
    EMBED_THRESHOLD = 10;
    vectorStores = new Map();
    constructor(configService, bedrockService, chromaService) {
        this.configService = configService;
        this.bedrockService = bedrockService;
        this.chromaService = chromaService;
    }
    shouldEmbedMessages(messageCount) {
        return messageCount > 0 && messageCount % this.EMBED_THRESHOLD === 0;
    }
    async addChatMemory(chatId, messages) {
        try {
            this.logger.log(`📚 Adding chat memory for ${chatId}, ${messages.length} messages`);
            const existingIds = new Set();
            if (this.vectorStores.has(chatId)) {
                try {
                    const existingDocs = await this.chromaService.getDocuments(`chat_memory_${chatId}`);
                    if (existingDocs.documents) {
                        for (const doc of existingDocs.documents) {
                            if (doc.metadata?.message_id) {
                                existingIds.add(doc.metadata.message_id);
                            }
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`Could not check existing messages: ${error.message}`);
                }
            }
            const documentsToAdd = [];
            let newMessageCount = 0;
            for (const msg of messages) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    const content = msg.content?.trim();
                    const messageId = msg.id;
                    if (existingIds.has(messageId) || !content) {
                        continue;
                    }
                    const embedding = await this.bedrockService.createTextEmbedding(content);
                    if (!embedding || embedding.length === 0) {
                        continue;
                    }
                    documentsToAdd.push({
                        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        document: content,
                        metadata: {
                            session_id: chatId,
                            role: msg.role,
                            timestamp: msg.timestamp || new Date().toISOString(),
                            message_id: messageId,
                        },
                        embedding: embedding,
                    });
                    newMessageCount++;
                }
            }
            if (documentsToAdd.length > 0) {
                await this.chromaService.addDocuments(`chat_memory_${chatId}`, documentsToAdd);
                this.logger.log(`📚 Added ${newMessageCount} new messages to memory for session ${chatId}`);
            }
            else {
                this.logger.log(`📚 No new messages to add for session ${chatId}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to add chat memory for ${chatId}:`, error);
            throw error;
        }
    }
    async clearChatMemory(chatId) {
        try {
            this.logger.log(`🧹 Clearing memory for chat ${chatId}`);
            await this.chromaService.deleteCollection(`chat_memory_${chatId}`);
            this.vectorStores.delete(chatId);
            this.logger.log(`🧹 Cleared chat memory for session ${chatId}`);
        }
        catch (error) {
            this.logger.error(`Failed to clear chat memory for ${chatId}:`, error);
            throw error;
        }
    }
    async searchMemory(query, collectionName, limit = 5, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`🔍 Searching memory for query: "${query}" in collection: ${collectionName}`);
            const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
            if (!queryEmbedding || queryEmbedding.length === 0) {
                return {
                    documents: [],
                    query,
                    totalResults: 0
                };
            }
            const results = await this.chromaService.queryCollection(collectionName, queryEmbedding, limit);
            if (!results) {
                return {
                    documents: [],
                    query,
                    totalResults: 0
                };
            }
            const documents = [];
            if (results.documents && results.documents.length > 0) {
                for (let i = 0; i < results.documents.length; i++) {
                    const doc = results.documents[i];
                    const metadata = results.metadatas?.[i] || {};
                    const distance = results.distances?.[i] || 0;
                    documents.push({
                        id: results.ids?.[i] || `doc_${i}`,
                        content: doc,
                        metadata: metadata,
                        similarity: 1 - distance,
                    });
                }
            }
            return {
                documents,
                query,
                totalResults: documents.length
            };
        }
        catch (error) {
            this.logger.error('Error searching memory:', error);
            return {
                documents: [],
                query,
                totalResults: 0
            };
        }
    }
    async addToMemory(content, collectionName, metadata = {}, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`📚 Adding content to memory collection: ${collectionName}`);
            const embedding = await this.bedrockService.createTextEmbedding(content);
            if (!embedding || embedding.length === 0) {
                throw new Error('Failed to create embedding for content');
            }
            const documentId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            const documentToAdd = [{
                    id: documentId,
                    document: content,
                    metadata: {
                        ...metadata,
                        created_at: new Date().toISOString(),
                        model_id: modelId,
                    },
                    embedding: embedding,
                }];
            await this.chromaService.addDocuments(collectionName, documentToAdd);
            return { success: true, documentId };
        }
        catch (error) {
            this.logger.error('Error adding to memory:', error);
            throw error;
        }
    }
    async removeFromMemory(documentId, collectionName) {
        try {
            this.logger.log(`🗑️ Removed document ${documentId} from collection: ${collectionName}`);
            await this.chromaService.deleteDocuments(collectionName, [documentId]);
            return { success: true };
        }
        catch (error) {
            this.logger.error('Error removing from memory:', error);
            throw error;
        }
    }
    async getMemoryStats(collectionName) {
        try {
            this.logger.log(`📊 Getting memory stats for collection: ${collectionName || 'all'}`);
            if (collectionName) {
                const docs = await this.chromaService.getDocuments(collectionName);
                return {
                    totalDocuments: docs.total || 0,
                    totalSessions: 1,
                    totalMessages: docs.total || 0,
                    collectionName,
                    status: 'ready'
                };
            }
            else {
                const collections = await this.chromaService.listCollections();
                let totalDocuments = 0;
                let totalSessions = 0;
                for (const collection of collections) {
                    try {
                        const docs = await this.chromaService.getDocuments(collection.name);
                        totalDocuments += docs.total || 0;
                        totalSessions++;
                    }
                    catch (error) {
                        this.logger.warn(`Could not get stats for collection ${collection.name}: ${error.message}`);
                    }
                }
                return {
                    totalDocuments,
                    totalSessions,
                    totalMessages: totalDocuments,
                    status: 'ready'
                };
            }
        }
        catch (error) {
            this.logger.error('Error getting memory stats:', error);
            return {
                totalDocuments: 0,
                totalSessions: 0,
                totalMessages: 0,
                collectionName,
                status: 'error'
            };
        }
    }
    async clearMemory(collectionName) {
        try {
            this.logger.log(`🧹 Clearing all memory from collection: ${collectionName}`);
            await this.chromaService.deleteCollection(collectionName);
            return {
                success: true,
                message: 'Memory cleared successfully'
            };
        }
        catch (error) {
            this.logger.error('Error clearing memory:', error);
            throw error;
        }
    }
    async updateMemoryDocument(documentId, newContent, collectionName, metadata = {}, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`✏️ Updating memory document ${documentId} in collection: ${collectionName}`);
            const embedding = await this.bedrockService.createTextEmbedding(newContent);
            if (!embedding || embedding.length === 0) {
                throw new Error('Failed to create embedding for updated content');
            }
            await this.chromaService.deleteDocuments(collectionName, [documentId]);
            const documentToAdd = [{
                    id: documentId,
                    document: newContent,
                    metadata: {
                        ...metadata,
                        updated_at: new Date().toISOString(),
                        model_id: modelId,
                    },
                    embedding: embedding,
                }];
            await this.chromaService.addDocuments(collectionName, documentToAdd);
            return { success: true };
        }
        catch (error) {
            this.logger.error('Error updating memory document:', error);
            throw error;
        }
    }
    async findRelatedMemories(conversationHistory, collectionName, limit = 3, modelId = 'amazon.titan-embed-text-v1') {
        try {
            this.logger.log(`🔍 Finding related memories for conversation in collection: ${collectionName}`);
            if (conversationHistory.length === 0) {
                return [];
            }
            const query = conversationHistory[conversationHistory.length - 1];
            const results = await this.searchMemory(query, collectionName, limit, modelId);
            return results.documents;
        }
        catch (error) {
            this.logger.error('Error finding related memories:', error);
            return [];
        }
    }
    async getMemorySummary(collectionName) {
        try {
            this.logger.log(`📊 Getting memory summary for collection: ${collectionName}`);
            const docs = await this.chromaService.getDocuments(collectionName, 10, 0);
            const sampleDocuments = docs.documents?.slice(0, 3).map(doc => typeof doc === 'string' ? doc : doc.document || doc.content || '') || [];
            const totalLength = docs.documents?.reduce((sum, doc) => {
                const content = typeof doc === 'string' ? doc : doc.document || doc.content || '';
                return sum + content.length;
            }, 0) || 0;
            const averageContentLength = docs.documents?.length ? totalLength / docs.documents.length : 0;
            return {
                totalDocuments: docs.total || 0,
                sampleDocuments,
                averageContentLength,
                modelIds: ['amazon.titan-embed-text-v1']
            };
        }
        catch (error) {
            this.logger.error('Error getting memory summary:', error);
            return {
                totalDocuments: 0,
                sampleDocuments: [],
                averageContentLength: 0,
                modelIds: []
            };
        }
    }
};
exports.MemoryToolService = MemoryToolService;
exports.MemoryToolService = MemoryToolService = MemoryToolService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        bedrock_service_1.BedrockService,
        chroma_service_1.ChromaService])
], MemoryToolService);
//# sourceMappingURL=memory-tool.service.js.map