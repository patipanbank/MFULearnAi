"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSearchTool = exports.KnowledgeTool = void 0;
const bedrock_1 = require("./bedrock");
const chroma_1 = require("./chroma");
const webSearch_1 = require("./webSearch");
const Collection_1 = require("../models/Collection");
const Document_1 = require("../models/Document");
class KnowledgeTool {
    constructor() {
        this.name = 'knowledge_search';
        this.description = "Searches the knowledge base for specific information, documents, or data. Use this to answer questions about internal topics.";
        this.inputSchema = {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: "The user's query to search for.",
                },
            },
            required: ['query'],
        };
    }
    async execute(input) {
        console.log(`KnowledgeTool executing with query: ${input.query}`);
        try {
            const contextData = await this.hierarchicalSearch(input.query);
            if (!contextData || !contextData.context) {
                return { success: true, content: 'No relevant information found in the knowledge base.' };
            }
            return { success: true, content: contextData.context, sources: contextData.sources };
        }
        catch (error) {
            console.error('Error executing KnowledgeTool:', error);
            return { success: false, content: 'An error occurred while searching the knowledge base.' };
        }
    }
    async hierarchicalSearch(query) {
        // L2 Search: Find the most relevant collections
        const relevantCollections = await this.selectRelevantCollections(query);
        if (relevantCollections.length === 0) {
            console.log('L2 Search: No relevant collections found.');
            return { context: '', sources: [] };
        }
        // L1 Search: For each relevant collection, find the most relevant documents
        let relevantDocuments = [];
        for (const collection of relevantCollections) {
            const docs = await this.selectRelevantDocuments(query, collection._id.toString());
            relevantDocuments.push(...docs);
        }
        if (relevantDocuments.length === 0) {
            console.log('L1 Search: No relevant documents found in selected collections.');
            return { context: '', sources: [] };
        }
        // L0 Retrieval: Get the final chunks from the most relevant documents
        const finalContext = await this.retrieveFinalContext(query, relevantDocuments);
        return finalContext;
    }
    async selectRelevantCollections(query) {
        const allCollections = await Collection_1.CollectionModel.find({
            $and: [
                { summary: { $ne: null } },
                { summary: { $ne: '' } }
            ]
        }).lean();
        if (allCollections.length <= 3) {
            return allCollections;
        }
        const collectionsString = allCollections
            .map(c => `  - ${c.name} (ID: ${c._id}): ${c.summary}`)
            .join('\\n');
        const prompt = `You are an AI routing agent. Select the most relevant data collections for the user's query. User Query: "${query}". Available Collections:\\n${collectionsString}\\n\\nRespond with a JSON object containing a list of collection names, like this: { "collections": ["collection_name_1", "collection_name_2"] }`;
        try {
            const response = await bedrock_1.bedrockService.invokeModelJSON(prompt);
            if (response && Array.isArray(response.collections)) {
                console.log('L2 Router selected collections:', response.collections);
                return allCollections.filter(c => response.collections.includes(c.name));
            }
            return allCollections;
        }
        catch (error) {
            console.error('Error in L2 collection selection:', error);
            return allCollections;
        }
    }
    async selectRelevantDocuments(query, collectionId) {
        const documentsInCollection = await Document_1.DocumentModel.find({
            collectionId: collectionId,
            status: Document_1.DocumentStatus.COMPLETED,
            $and: [
                { summary: { $ne: null } },
                { summary: { $ne: '' } }
            ]
        }).lean();
        if (documentsInCollection.length <= 5) {
            return documentsInCollection;
        }
        const documentsString = documentsInCollection
            .map(d => `  - ${d.name} (ID: ${d._id}): ${d.summary}`)
            .join('\\n');
        const prompt = `You are an AI routing agent. From the collection, select the most relevant documents for the user's query. User Query: "${query}". Available Documents:\\n${documentsString}\\n\\nRespond with a JSON object containing a list of document IDs, like this: { "document_ids": ["id_1", "id_2"] }`;
        try {
            const response = await bedrock_1.bedrockService.invokeModelJSON(prompt);
            if (response && Array.isArray(response.document_ids)) {
                console.log('L1 Router selected documents:', response.document_ids);
                return documentsInCollection.filter(d => response.document_ids.includes(d._id.toString()));
            }
            return documentsInCollection.slice(0, 5);
        }
        catch (error) {
            console.error('Error in L1 document selection:', error);
            return documentsInCollection.slice(0, 5);
        }
    }
    async retrieveFinalContext(query, documents) {
        let allChunksText = [];
        let allSources = [];
        for (const doc of documents) {
            const hybridResult = await chroma_1.chromaService.hybridSearchWithReRanking(doc.collectionId.toString(), query, 5, { documentId: doc._id.toString() });
            if (hybridResult?.documents && hybridResult.documents.length > 0) {
                allChunksText.push(...hybridResult.documents);
                const sources = hybridResult.metadatas.map((metadata, index) => ({
                    modelId: metadata.modelId,
                    collectionName: metadata.collectionName,
                    filename: metadata.filename,
                    similarity: hybridResult.scores[index] || 0,
                }));
                allSources.push(...sources);
            }
        }
        if (allChunksText.length === 0) {
            return { context: '', sources: [] };
        }
        const compressionResult = await chroma_1.chromaService.selectAndCompressContext(query, allChunksText, [], [], 4000);
        return {
            context: compressionResult.compressedContext,
            sources: allSources,
            compressionStats: compressionResult.compressionStats
        };
    }
}
exports.KnowledgeTool = KnowledgeTool;
class WebSearchTool {
    constructor() {
        this.name = 'web_search';
        this.description = "Searches the web for up-to-date information. Use this for current events or general knowledge questions.";
        this.inputSchema = {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query.' },
            },
            required: ['query'],
        };
    }
    async execute(input) {
        console.log(`WebSearchTool executing with query: ${input.query}`);
        try {
            const searchResultText = await webSearch_1.webSearchService.searchWeb(input.query);
            if (!searchResultText) {
                return { success: true, content: 'No results found on the web.' };
            }
            return { success: true, content: searchResultText };
        }
        catch (error) {
            console.error('Error executing WebSearchTool:', error);
            return { success: false, content: 'An error occurred while searching the web.' };
        }
    }
}
exports.WebSearchTool = WebSearchTool;
