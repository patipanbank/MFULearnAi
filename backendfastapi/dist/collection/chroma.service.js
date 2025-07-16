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
var ChromaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChromaService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const chromadb = require("chromadb");
let ChromaService = ChromaService_1 = class ChromaService {
    configService;
    bedrockService;
    logger = new common_1.Logger(ChromaService_1.name);
    client;
    defaultEmbeddingFunction;
    constructor(configService, bedrockService) {
        this.configService = configService;
        this.bedrockService = bedrockService;
        this.initializeChromaClient();
    }
    async initializeChromaClient() {
        try {
            const chromaUrl = this.configService.get('CHROMA_URL') || 'http://localhost:8000';
            this.logger.log(`🔍 Initializing ChromaDB with URL: ${chromaUrl}`);
            const urlParts = chromaUrl.split(':');
            const host = urlParts[1].replace('//', '');
            const port = parseInt(urlParts[2]);
            this.logger.log(`🔗 Connecting to ChromaDB at ${host}:${port}`);
            this.client = new chromadb.ChromaClient({
                path: `${host}:${port}`,
            });
            this.logger.log('✅ ChromaDB client initialized successfully');
        }
        catch (error) {
            this.logger.error(`❌ Failed to initialize ChromaDB client: ${error.message}`);
            throw new Error(`Failed to initialize ChromaDB client: ${error.message}`);
        }
    }
    async getCollection(name) {
        if (!this.client) {
            throw new Error('ChromaDB client is not initialized');
        }
        try {
            this.logger.log(`📁 Getting or creating collection: ${name}`);
            const collection = await this.client.getOrCreateCollection({
                name: name,
            });
            this.logger.log(`✅ Successfully got collection: ${name}`);
            return collection;
        }
        catch (error) {
            this.logger.error(`❌ Error getting or creating collection '${name}': ${error.message}`);
            throw error;
        }
    }
    async listCollections() {
        if (!this.client) {
            throw new Error('ChromaDB client is not initialized');
        }
        try {
            const collections = await this.client.listCollections();
            return collections.map((col) => ({
                name: col.name,
                metadata: col.metadata,
            }));
        }
        catch (error) {
            this.logger.error(`❌ Error listing collections: ${error.message}`);
            return [];
        }
    }
    async deleteCollection(collectionName) {
        if (!this.client) {
            throw new Error('ChromaDB client is not initialized');
        }
        try {
            await this.client.deleteCollection({
                name: collectionName,
            });
            this.logger.log(`🗑️ Collection ${collectionName} deleted successfully`);
        }
        catch (error) {
            this.logger.error(`❌ Error deleting collection ${collectionName}: ${error.message}`);
            throw new Error(`Failed to delete collection ${collectionName}`);
        }
    }
    async queryCollection(collectionName, queryEmbeddings, nResults = 5) {
        try {
            const collection = await this.getCollection(collectionName);
            const results = await collection.query({
                queryEmbeddings: [queryEmbeddings],
                nResults: nResults,
                include: ["metadatas", "documents", "distances"]
            });
            return {
                ids: results.ids?.[0]?.filter(id => id !== null) || [],
                documents: results.documents?.[0]?.filter(doc => doc !== null) || [],
                metadatas: results.metadatas?.[0]?.filter(meta => meta !== null).map(meta => meta) || [],
                distances: results.distances?.[0] || [],
            };
        }
        catch (error) {
            this.logger.error(`❌ Error querying collection '${collectionName}': ${error.message}`);
            return null;
        }
    }
    async addDocuments(collectionName, documentsWithEmbeddings) {
        if (!documentsWithEmbeddings || documentsWithEmbeddings.length === 0) {
            this.logger.log('⚠️ No documents to process. Skipping.');
            return;
        }
        try {
            const collection = await this.getCollection(collectionName);
            const docs = documentsWithEmbeddings.map(item => item.document);
            const metadatas = documentsWithEmbeddings.map(item => item.metadata);
            const embeddings = documentsWithEmbeddings.map(item => item.embedding);
            const ids = documentsWithEmbeddings.map(item => item.id);
            if (!docs.length) {
                this.logger.log('⚠️ Empty document list after unpacking. Skipping add to collection.');
                return;
            }
            await collection.add({
                ids: ids,
                embeddings: embeddings,
                documents: docs,
                metadatas: metadatas,
            });
            this.logger.log(`📚 Successfully added ${docs.length} documents to '${collectionName}'`);
        }
        catch (error) {
            this.logger.error(`❌ Error during batch add to collection '${collectionName}': ${error.message}`);
            throw error;
        }
    }
    async getDocuments(collectionName, limit = 100, offset = 0) {
        try {
            const collection = await this.getCollection(collectionName);
            if (!collection) {
                this.logger.log(`❌ Collection '${collectionName}' not found`);
                return { documents: [], total: 0 };
            }
            const totalCount = await collection.count();
            const results = await collection.get({
                limit: limit,
                offset: offset,
                include: ["metadatas", "documents"]
            });
            const docs = [];
            if (results.ids && results.ids.length > 0) {
                for (let i = 0; i < results.ids.length; i++) {
                    const docData = {
                        id: results.ids[i],
                        document: results.documents?.[i] || null,
                        metadata: results.metadatas?.[i] || null
                    };
                    docs.push(docData);
                }
            }
            this.logger.log(`📄 Getting documents from collection '${collectionName}'`);
            return { documents: docs, total: totalCount };
        }
        catch (error) {
            this.logger.error(`❌ Error getting documents from collection '${collectionName}': ${error.message}`);
            return { documents: [], total: 0 };
        }
    }
    async deleteDocuments(collectionName, documentIds) {
        if (!documentIds || documentIds.length === 0) {
            return;
        }
        try {
            const collection = await this.getCollection(collectionName);
            if (!collection) {
                throw new Error(`Collection '${collectionName}' not found`);
            }
            await collection.delete({
                ids: documentIds
            });
            this.logger.log(`🗑️ Deleted ${documentIds.length} documents from collection '${collectionName}'`);
        }
        catch (error) {
            this.logger.error(`❌ Error deleting documents from collection '${collectionName}': ${error.message}`);
            throw error;
        }
    }
    async deleteDocumentsBySource(collectionName, sourceName) {
        try {
            const collection = await this.getCollection(collectionName);
            if (!collection) {
                throw new Error(`Collection '${collectionName}' not found`);
            }
            const results = await collection.get({
                where: { "source": sourceName },
                include: []
            });
            const docIdsToDelete = results.ids;
            if (!docIdsToDelete || docIdsToDelete.length === 0) {
                this.logger.log(`No documents found with source '${sourceName}' in collection '${collectionName}'.`);
                return;
            }
            this.logger.log(`Found ${docIdsToDelete.length} documents from source '${sourceName}' to delete.`);
            await this.deleteDocuments(collectionName, docIdsToDelete);
            this.logger.log(`Successfully deleted documents from source '${sourceName}'.`);
        }
        catch (error) {
            this.logger.error(`❌ Error deleting documents by source: ${error.message}`);
            throw error;
        }
    }
    getVectorStore(collectionName) {
        try {
            this.logger.log(`🔍 Creating vector store for collection: ${collectionName}`);
            const vectorStore = {
                collection_name: collectionName,
                similarity_search: async (query, k = 5) => {
                    const embedding = await this.bedrockService.createTextEmbedding(query);
                    const results = await this.queryCollection(collectionName, embedding, k);
                    return results?.documents?.map((doc, i) => ({
                        page_content: doc,
                        metadata: results.metadatas?.[i] || {},
                    })) || [];
                },
                get: async () => {
                    const results = await this.getDocuments(collectionName);
                    return {
                        documents: results.documents.map(doc => doc.document),
                        metadatas: results.documents.map(doc => doc.metadata),
                    };
                },
                add_documents: async (documents) => {
                    const docs = documents.map(async (doc) => ({
                        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        document: doc.page_content,
                        metadata: doc.metadata,
                        embedding: await this.bedrockService.createTextEmbedding(doc.page_content),
                    }));
                    const resolvedDocs = await Promise.all(docs);
                    await this.addDocuments(collectionName, resolvedDocs);
                },
                delete_collection: async () => {
                    await this.deleteCollection(collectionName);
                },
            };
            this.logger.log(`📊 Collection '${collectionName}' vector store created`);
            return vectorStore;
        }
        catch (error) {
            this.logger.error(`❌ Error creating vector store for ${collectionName}: ${error.message}`);
            return null;
        }
    }
};
exports.ChromaService = ChromaService;
exports.ChromaService = ChromaService = ChromaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        bedrock_service_1.BedrockService])
], ChromaService);
//# sourceMappingURL=chroma.service.js.map