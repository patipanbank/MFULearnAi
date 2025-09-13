"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrievalTool = void 0;
class RetrievalTool {
    constructor(collectionName) {
        this.collectionName = collectionName;
    }
    getToolMeta() {
        return {
            name: `search_${this.collectionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            description: `Search documents in the "${this.collectionName}" knowledge base. Use this to find relevant information from uploaded documents in this collection.`,
            func: async (query, _sessionId, config) => {
                try {
                    const limit = config?.limit || 5;
                    const threshold = config?.threshold || 0.7;
                    const { chromaService } = await Promise.resolve().then(() => __importStar(require('../../services/chromaService')));
                    const results = await chromaService.searchDocuments(this.collectionName, query, limit);
                    if (!results || results.length === 0) {
                        return `No relevant documents found in "${this.collectionName}" for: "${query}"`;
                    }
                    const filteredResults = results
                        .filter((result) => result.score >= threshold)
                        .slice(0, limit);
                    if (filteredResults.length === 0) {
                        return `No highly relevant documents found in "${this.collectionName}" for: "${query}" (all results below ${threshold} similarity threshold)`;
                    }
                    const formatted = filteredResults.map((result, index) => {
                        const metadata = result.metadata || {};
                        return `${index + 1}. ${metadata.filename || 'Unknown File'} (Score: ${(result.score * 100).toFixed(1)}%)\n` +
                            `   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n` +
                            `   Page: ${metadata.page || 'N/A'}, Chunk: ${metadata.chunk_id || 'N/A'}\n`;
                    }).join('\n');
                    return `Found ${filteredResults.length} relevant document(s) in "${this.collectionName}" for "${query}":\n\n${formatted}`;
                }
                catch (error) {
                    console.error(`Retrieval tool error for ${this.collectionName}:`, error);
                    return `Error searching "${this.collectionName}": ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            }
        };
    }
    getAdvancedSearchMeta() {
        return {
            name: `advanced_search_${this.collectionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            description: `Advanced search in "${this.collectionName}" with filters. Supports file type filtering, date ranges, and custom similarity thresholds.`,
            func: async (input, _sessionId) => {
                try {
                    let params;
                    try {
                        params = JSON.parse(input);
                    }
                    catch {
                        params = { query: input };
                    }
                    const { query, fileType, limit = 10, threshold = 0.6 } = params;
                    if (!query) {
                        return 'Error: Query is required for advanced search';
                    }
                    const filters = {};
                    if (fileType) {
                        filters.file_type = fileType;
                    }
                    const { chromaService } = await Promise.resolve().then(() => __importStar(require('../../services/chromaService')));
                    const results = await chromaService.searchDocumentsWithFilter(this.collectionName, query, filters, limit);
                    if (!results || results.length === 0) {
                        return `No documents found in "${this.collectionName}" matching the criteria`;
                    }
                    const filteredResults = results.filter((result) => result.score >= threshold);
                    if (filteredResults.length === 0) {
                        return `No documents found above ${threshold} similarity threshold`;
                    }
                    const formatted = filteredResults.map((result, index) => {
                        const metadata = result.metadata || {};
                        return `${index + 1}. ${metadata.filename || 'Unknown File'}\n` +
                            `   Type: ${metadata.file_type || 'Unknown'} | Score: ${(result.score * 100).toFixed(1)}%\n` +
                            `   ${result.content.substring(0, 150)}...\n`;
                    }).join('\n');
                    return `Advanced search results in "${this.collectionName}" (${filteredResults.length} results):\n\n${formatted}`;
                }
                catch (error) {
                    console.error(`Advanced retrieval error for ${this.collectionName}:`, error);
                    return `Error in advanced search: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            }
        };
    }
}
exports.RetrievalTool = RetrievalTool;
//# sourceMappingURL=RetrievalTool.js.map