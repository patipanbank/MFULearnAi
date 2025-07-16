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
const chromadb_1 = require("chromadb");
let ChromaService = ChromaService_1 = class ChromaService {
    configService;
    logger = new common_1.Logger(ChromaService_1.name);
    client;
    constructor(configService) {
        this.configService = configService;
        this.initializeChromaClient();
    }
    initializeChromaClient() {
        const chromaUrl = this.configService.get('CHROMA_URL');
        if (!chromaUrl) {
            throw new Error('CHROMA_URL is not set in the environment variables.');
        }
        try {
            const urlParts = chromaUrl.split(':');
            const host = urlParts[1].replace('//', '');
            const port = parseInt(urlParts[2]);
            this.logger.log(`Connecting to ChromaDB at ${host}:${port}`);
            this.client = new chromadb_1.ChromaClient({
                path: `http://${host}:${port}`,
            });
            this.logger.log('ChromaDB client initialized successfully.');
        }
        catch (error) {
            this.logger.error(`Failed to initialize ChromaDB client: ${error}`);
            throw new Error(`Failed to initialize ChromaDB client: ${error}`);
        }
    }
    async getCollection(name) {
        if (!this.client) {
            throw new Error('ChromaDB client is not initialized.');
        }
        try {
            this.logger.log(`Getting or creating collection: ${name}`);
            const collection = await this.client.getOrCreateCollection({ name });
            this.logger.log(`Successfully got collection: ${name}`);
            return collection;
        }
        catch (error) {
            this.logger.error(`Error getting or creating collection '${name}': ${error}`);
            throw error;
        }
    }
    async listCollections() {
        if (!this.client) {
            throw new Error('ChromaDB client is not initialized.');
        }
        try {
            const collections = await this.client.listCollections();
            return collections;
        }
        catch (error) {
            this.logger.error(`Error listing collections: ${error}`);
            throw error;
        }
    }
    async deleteCollection(collectionName) {
        if (!this.client) {
            throw new Error('ChromaDB client is not initialized.');
        }
        try {
            await this.client.deleteCollection({ name: collectionName });
            this.logger.log(`Collection ${collectionName} deleted successfully.`);
        }
        catch (error) {
            this.logger.error(`Error deleting collection '${collectionName}': ${error}`);
            throw new Error(`Failed to delete collection ${collectionName}`);
        }
    }
    async queryCollection(collectionName, queryEmbeddings, nResults = 5) {
        try {
            const collection = await this.getCollection(collectionName);
            const results = await collection.query({
                queryEmbeddings,
                nResults,
                include: ['documents', 'metadatas', 'distances'],
            });
            if (results && results.documents) {
                results.documents = results.documents.map(arr => arr.map(doc => doc || ''));
            }
            return results;
        }
        catch (error) {
            this.logger.error(`Error querying collection '${collectionName}': ${error}`);
            return null;
        }
    }
    async addToCollection(collectionName, documents, embeddings, metadatas, ids) {
        if (!documents.length) {
            this.logger.log('No documents to add. Skipping.');
            return;
        }
        const collection = await this.getCollection(collectionName);
        try {
            await collection.add({
                ids,
                embeddings: embeddings ?? [],
                documents: documents ?? [],
                metadatas: metadatas ?? [],
            });
            this.logger.log(`Successfully added ${documents.length} documents to '${collectionName}'.`);
        }
        catch (error) {
            this.logger.error(`Error adding to collection '${collectionName}': ${error}`);
            throw error;
        }
    }
    async addDocuments(collectionName, documentsWithEmbeddings) {
        if (!documentsWithEmbeddings.length) {
            this.logger.log('No documents to process. Skipping.');
            return;
        }
        const collection = await this.getCollection(collectionName);
        const docs = documentsWithEmbeddings.map(item => item.document);
        const metadatas = documentsWithEmbeddings.map(item => item.metadata);
        const embeddings = documentsWithEmbeddings.map(item => item.embedding ?? []);
        const ids = documentsWithEmbeddings.map(item => item.id);
        if (!docs.length) {
            this.logger.log('Empty document list after unpacking. Skipping add to collection.');
            return;
        }
        try {
            await collection.add({
                ids,
                embeddings,
                documents: docs,
                metadatas,
            });
            this.logger.log(`Successfully added ${docs.length} documents to '${collectionName}'.`);
        }
        catch (error) {
            this.logger.error(`Error during batch add to collection '${collectionName}': ${error}`);
            throw error;
        }
    }
    async getDocuments(collectionName, limit = 100, offset = 0) {
        try {
            const collection = await this.getCollection(collectionName);
            if (!collection) {
                this.logger.log(`Collection '${collectionName}' not found`);
                return { documents: [], total: 0 };
            }
            const totalCount = await collection.count();
            const results = await collection.get({
                limit,
                offset,
                include: ['documents', 'metadatas'],
            });
            const docs = [];
            if (results && results.ids) {
                for (let i = 0; i < results.ids.length; i++) {
                    const docData = {
                        id: results.ids[i],
                        document: results.documents?.[i] || '',
                        metadata: results.metadatas?.[i] || {},
                    };
                    docs.push(docData);
                }
            }
            return { documents: docs, total: totalCount };
        }
        catch (error) {
            this.logger.error(`Error getting documents from collection '${collectionName}': ${error}`);
            return { documents: [], total: 0 };
        }
    }
    async deleteDocuments(collectionName, documentIds) {
        if (!documentIds.length) {
            return;
        }
        const collection = await this.getCollection(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found.`);
        }
        await collection.delete({ ids: documentIds });
    }
    async deleteDocumentsBySource(collectionName, sourceName) {
        const collection = await this.getCollection(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found.`);
        }
        const results = await collection.get({
            where: { source: sourceName },
            include: [],
        });
        const docIdsToDelete = results.ids;
        if (!docIdsToDelete.length) {
            this.logger.log(`No documents found with source '${sourceName}' in collection '${collectionName}'.`);
            return;
        }
        this.logger.log(`Found ${docIdsToDelete.length} documents from source '${sourceName}' to delete.`);
        await this.deleteDocuments(collectionName, docIdsToDelete);
        this.logger.log(`Successfully deleted documents from source '${sourceName}'.`);
    }
    async updateCollection(collectionName, ids, embeddings, documents, metadatas) {
        const collection = await this.getCollection(collectionName);
        try {
            await collection.update({
                ids,
                embeddings: embeddings ?? [],
                documents: documents ?? [],
                metadatas: metadatas ?? [],
            });
            this.logger.log(`Successfully updated ${ids.length} documents in '${collectionName}'.`);
        }
        catch (error) {
            this.logger.error(`Error updating collection '${collectionName}': ${error}`);
            throw error;
        }
    }
    async upsertCollection(collectionName, ids, embeddings, documents, metadatas) {
        const collection = await this.getCollection(collectionName);
        try {
            await collection.upsert({
                ids,
                embeddings: embeddings ?? [],
                documents: documents ?? [],
                metadatas: metadatas ?? [],
            });
            this.logger.log(`Successfully upserted ${ids.length} documents in '${collectionName}'.`);
        }
        catch (error) {
            this.logger.error(`Error upserting collection '${collectionName}': ${error}`);
            throw error;
        }
    }
};
exports.ChromaService = ChromaService;
exports.ChromaService = ChromaService = ChromaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], ChromaService);
//# sourceMappingURL=chroma.service.js.map