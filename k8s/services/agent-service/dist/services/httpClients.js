"use strict";
/**
 * HTTP Clients for calling other microservices
 * Replaces direct service imports with HTTP calls
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bedrockClient = exports.storageClient = exports.ragClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config/config"));
// RAG Service Client
exports.ragClient = {
    async searchMemory(sessionId, query, limit = 5) {
        try {
            const response = await axios_1.default.post(`${config_1.default.ragServiceUrl}/api/memory/search`, {
                sessionId,
                query,
                limit
            });
            return response.data;
        }
        catch (error) {
            console.error('RAG service error:', error);
            return [];
        }
    },
    async embedMessage(sessionId, content) {
        try {
            await axios_1.default.post(`${config_1.default.ragServiceUrl}/api/memory/embed`, {
                sessionId,
                content
            });
        }
        catch (error) {
            console.error('RAG service error:', error);
        }
    },
    async searchCollection(collectionName, query, limit = 5) {
        try {
            const response = await axios_1.default.post(`${config_1.default.ragServiceUrl}/api/collections/search`, {
                collectionName,
                query,
                limit
            });
            return response.data;
        }
        catch (error) {
            console.error('RAG service error:', error);
            return { documents: [], metadatas: [] };
        }
    },
    async embed(text) {
        try {
            const response = await axios_1.default.post(`${config_1.default.ragServiceUrl}/api/embed`, {
                text
            });
            return response.data.embedding;
        }
        catch (error) {
            console.error('RAG service error:', error);
            return [];
        }
    }
};
// Storage Service Client
exports.storageClient = {
    async getDocument(documentId) {
        try {
            const response = await axios_1.default.get(`${config_1.default.storageServiceUrl}/api/documents/${documentId}`);
            return response.data;
        }
        catch (error) {
            console.error('Storage service error:', error);
            return null;
        }
    }
};
// Bedrock Client stub - Use AWS SDK directly via ChatBedrockConverse in LangGraph
exports.bedrockClient = {
    async invoke(params) {
        console.warn('bedrockClient stub - use ChatBedrockConverse instead');
        return {};
    }
};
//# sourceMappingURL=httpClients.js.map