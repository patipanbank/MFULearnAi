"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chromaService = exports.ChromaService = void 0;
const chromadb_1 = require("chromadb");
class ChromaService {
    constructor() {
        const url = process.env.CHROMA_URL || 'http://localhost:8000';
        this.client = new chromadb_1.ChromaClient({ path: url });
    }
    async getOrCreateCollection(name) {
        try {
            return await this.client.getOrCreateCollection({ name });
        }
        catch (e) {
            console.error(`[ChromaService] Error getOrCreateCollection:`, e);
            throw e;
        }
    }
    async listCollections() {
        try {
            return await this.client.listCollections();
        }
        catch (e) {
            console.error(`[ChromaService] Error listCollections:`, e);
            throw e;
        }
    }
    async deleteCollection(collectionName) {
        try {
            return await this.client.deleteCollection({ name: collectionName });
        }
        catch (e) {
            console.error(`[ChromaService] Error deleteCollection:`, e);
            throw e;
        }
    }
    async addToCollection(collectionName, documents, embeddings, metadatas, ids) {
        if (!documents || documents.length === 0) {
            console.log('[ChromaService] No documents to add. Skipping.');
            return;
        }
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            return await collection.add({
                ids,
                embeddings,
                documents,
                metadatas,
            });
        }
        catch (e) {
            console.error(`[ChromaService] Error addToCollection:`, e);
            throw e;
        }
    }
    async addDocuments(collectionName, documentsWithEmbeddings) {
        if (!documentsWithEmbeddings || documentsWithEmbeddings.length === 0) {
            console.log('[ChromaService] No documents to process. Skipping.');
            return;
        }
        const seen = new Set();
        const docs = [];
        const metadatas = [];
        const embeddings = [];
        const ids = [];
        for (const item of documentsWithEmbeddings) {
            if (seen.has(item.id))
                continue;
            seen.add(item.id);
            docs.push(item.document);
            metadatas.push(item.metadata);
            embeddings.push(item.embedding);
            ids.push(item.id);
        }
        if (docs.length === 0) {
            console.log('[ChromaService] All documents are duplicates. Skipping.');
            return;
        }
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            await collection.add({
                ids,
                embeddings,
                documents: docs,
                metadatas,
            });
            console.log(`[ChromaService] Successfully added ${docs.length} documents to '${collectionName}'.`);
        }
        catch (e) {
            console.error(`[ChromaService] Error addDocuments:`, e);
            throw e;
        }
    }
    async queryCollection(collectionName, queryEmbeddings, nResults = 5) {
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            return await collection.query({
                queryEmbeddings,
                nResults,
                include: ["metadatas", "documents", "distances"],
            });
        }
        catch (e) {
            console.error(`[ChromaService] Error queryCollection:`, e);
            return null;
        }
    }
    async getDocuments(collectionName, limit = 100, offset = 0) {
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            const all = await collection.get();
            const docs = [];
            if (all && all.ids) {
                for (let i = offset; i < Math.min(offset + limit, all.ids.length); i++) {
                    docs.push({
                        id: all.ids[i],
                        document: all.documents?.[i],
                        metadata: all.metadatas?.[i],
                    });
                }
            }
            if (docs.length > 0) {
                console.log(`[ChromaService] Sample documents in '${collectionName}':`);
                for (let i = 0; i < Math.min(2, docs.length); i++) {
                    console.log(`  ${i + 1}. ${docs[i].document?.slice(0, 100)}...`);
                }
            }
            return { documents: docs, total: all.ids?.length || 0 };
        }
        catch (e) {
            console.error(`[ChromaService] Error getDocuments:`, e);
            return { documents: [], total: 0 };
        }
    }
    async deleteDocuments(collectionName, documentIds) {
        if (!documentIds || documentIds.length === 0)
            return;
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            return await collection.delete({ ids: documentIds });
        }
        catch (e) {
            console.error(`[ChromaService] Error deleteDocuments:`, e);
            throw e;
        }
    }
    async deleteDocumentsBySource(collectionName, sourceName) {
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            const results = await collection.get({ where: { source: sourceName } });
            const docIdsToDelete = results.ids;
            if (!docIdsToDelete || docIdsToDelete.length === 0) {
                console.log(`[ChromaService] No documents found with source '${sourceName}' in collection '${collectionName}'.`);
                return;
            }
            await this.deleteDocuments(collectionName, docIdsToDelete);
            console.log(`[ChromaService] Successfully deleted documents from source '${sourceName}'.`);
        }
        catch (e) {
            console.error(`[ChromaService] Error deleteDocumentsBySource:`, e);
            throw e;
        }
    }
    async getAllFromCollection(collectionName) {
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            const all = await collection.get();
            const docs = [];
            if (all && all.ids) {
                for (let i = 0; i < all.ids.length; i++) {
                    docs.push({
                        id: all.ids[i],
                        document: all.documents?.[i] ?? null,
                        metadata: all.metadatas?.[i],
                    });
                }
            }
            return docs;
        }
        catch (e) {
            console.error(`[ChromaService] Error getAllFromCollection:`, e);
            return [];
        }
    }
    getVectorStore(collectionName) {
        console.log(`[ChromaService] getVectorStore is not implemented in this version.`);
        return null;
    }
}
exports.ChromaService = ChromaService;
exports.chromaService = new ChromaService();
//# sourceMappingURL=chromaService.js.map