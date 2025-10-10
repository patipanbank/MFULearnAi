"use strict";
/**
 * Chroma Service stub - Direct API calls to RAG service used in LangGraph
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chromaService = void 0;
exports.chromaService = {
    searchCollection: async (collectionName, query, nResults = 5) => {
        return { documents: [], metadatas: [] };
    },
    embedText: async (text) => {
        return [];
    },
    queryCollection: async (collectionName, queryEmbeddings, nResults = 5) => {
        return { documents: [], metadatas: [], distances: [] };
    },
    getDocuments: async (collectionName) => {
        return { documents: [], metadatas: [], ids: [] };
    },
    addToCollection: async (collectionName, documents, metadatas, ids) => {
        console.warn('chromaService.addToCollection stub');
    }
};
//# sourceMappingURL=chromaService.js.map