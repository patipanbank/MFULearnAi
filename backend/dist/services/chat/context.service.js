"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextService = exports.ContextService = void 0;
const chroma_1 = require("../chroma");
const bedrock_1 = require("../bedrock");
const webSearch_1 = require("../webSearch");
const Model_1 = require("../../models/Model");
const constants_1 = require("../../constants");
/**
 * Service for retrieving and processing context from collections and web
 */
class ContextService {
    /**
     * Sanitize collection name for ChromaDB
     */
    sanitizeCollectionName(name) {
        return name.replace(/:/g, '-');
    }
    /**
     * Resolve collections from model ID or return directly if array provided
     */
    async resolveCollections(modelIdOrCollections) {
        try {
            if (Array.isArray(modelIdOrCollections)) {
                return modelIdOrCollections;
            }
            const model = await Model_1.ModelModel.findById(modelIdOrCollections);
            if (!model) {
                console.error('Model not found:', modelIdOrCollections);
                return [];
            }
            return model.collections;
        }
        catch (error) {
            console.error('Error resolving collections:', error);
            return [];
        }
    }
    /**
     * Process batch of collections
     */
    async processBatch(batch, queryEmbedding, imageEmbedding) {
        return Promise.all(batch.map(async (name) => {
            try {
                const queryResult = (await chroma_1.chromaService.queryDocumentsWithEmbedding(name, imageEmbedding || queryEmbedding, constants_1.COLLECTION_CONFIG.MAX_RESULTS_PER_COLLECTION));
                if (!queryResult?.documents || !queryResult?.metadatas) {
                    return { context: '', sources: [] };
                }
                const results = queryResult.documents.map((doc, index) => ({
                    text: doc,
                    metadata: queryResult.metadatas[index],
                    similarity: 1 - (queryResult.distances?.[index] || 0),
                }));
                const filteredResults = results
                    .filter((result) => result.similarity >= constants_1.COLLECTION_CONFIG.MIN_SIMILARITY_THRESHOLD)
                    .sort((a, b) => b.similarity - a.similarity);
                const sources = filteredResults.map((result) => ({
                    modelId: result.metadata.modelId,
                    collectionName: name,
                    filename: result.metadata.filename,
                    similarity: result.similarity,
                }));
                return {
                    context: filteredResults.map((r) => r.text).join('\n\n'),
                    sources,
                };
            }
            catch (error) {
                console.error(`Error querying collection ${name}:`, error);
                return { context: '', sources: [] };
            }
        }));
    }
    /**
     * Process and filter collection results
     */
    processResults(results) {
        const contexts = results
            .filter((r) => {
            if (r.sources.length === 0)
                return false;
            const maxSimilarity = Math.max(...r.sources.map((s) => s.similarity));
            return maxSimilarity >= constants_1.COLLECTION_CONFIG.MIN_COLLECTION_SIMILARITY;
        })
            .sort((a, b) => {
            const aMaxSim = Math.max(...a.sources.map((s) => s.similarity));
            const bMaxSim = Math.max(...b.sources.map((s) => s.similarity));
            return bMaxSim - aMaxSim;
        })
            .map((r) => r.context);
        let context = '';
        for (const result of contexts) {
            if (result && result.length > 0) {
                let resultToAdd = result;
                if (resultToAdd.length > constants_1.COLLECTION_CONFIG.MAX_CONTEXT_LENGTH) {
                    resultToAdd = resultToAdd.substring(0, constants_1.COLLECTION_CONFIG.MAX_CONTEXT_LENGTH);
                    const lastPeriodIndex = resultToAdd.lastIndexOf('.');
                    const lastNewlineIndex = resultToAdd.lastIndexOf('\n');
                    const lastBreakIndex = Math.max(lastPeriodIndex, lastNewlineIndex);
                    if (lastBreakIndex > constants_1.COLLECTION_CONFIG.MAX_CONTEXT_LENGTH * 0.8) {
                        resultToAdd = resultToAdd.substring(0, lastBreakIndex + 1);
                    }
                }
                if (context.length + resultToAdd.length > constants_1.COLLECTION_CONFIG.MAX_CONTEXT_LENGTH) {
                    break;
                }
                context += resultToAdd + '\n';
            }
        }
        return context;
    }
    /**
     * Create batches from array
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    /**
     * Get context from collections and web search
     */
    async getContext(query, modelIdOrCollections, imageBase64) {
        const collectionNames = await this.resolveCollections(modelIdOrCollections);
        let context = '';
        // Get context from collections
        if (collectionNames.length > 0) {
            const sanitizedCollections = collectionNames.map((name) => this.sanitizeCollectionName(name));
            const truncatedQuery = query.slice(0, 512);
            let queryEmbedding = await chroma_1.chromaService.getQueryEmbedding(truncatedQuery);
            let imageEmbedding;
            if (imageBase64) {
                try {
                    imageEmbedding = await bedrock_1.bedrockService.embedImage(imageBase64, truncatedQuery);
                }
                catch (error) {
                    console.error('Error generating image embedding:', error);
                }
            }
            const batches = this.createBatches(sanitizedCollections, constants_1.COLLECTION_CONFIG.BATCH_SIZE);
            let allResults = [];
            for (const batch of batches) {
                const batchResults = await this.processBatch(batch, queryEmbedding, imageEmbedding);
                allResults = allResults.concat(batchResults);
            }
            context = this.processResults(allResults);
        }
        // Get web search results
        const lastQuestion = query.split('\n').pop() || query;
        try {
            const webResults = await webSearch_1.webSearchService.searchWeb(lastQuestion);
            if (webResults) {
                if (context) {
                    context += '\n\nAdditional supporting information:\n' + webResults;
                }
                else {
                    context = 'Based on web search results:\n' + webResults;
                }
            }
        }
        catch (error) {
            console.error('Error fetching web results:', error);
        }
        return context;
    }
}
exports.ContextService = ContextService;
exports.contextService = new ContextService();
