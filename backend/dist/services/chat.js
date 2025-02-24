"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const bedrock_1 = require("./bedrock");
const chroma_1 = require("./chroma");
const Model_1 = require("../models/Model");
class ChatService {
    constructor() {
        this.questionTypes = {
            FACTUAL: 'factual',
            ANALYTICAL: 'analytical',
            CONCEPTUAL: 'conceptual',
            PROCEDURAL: 'procedural',
            CLARIFICATION: 'clarification'
        };
        this.systemPrompt = `You are DinDin, a knowledgeable AI assistant. Follow these guidelines:
1. Be concise and direct in your responses
2. When citing information, mention the source document
3. If uncertain, acknowledge the limitations
4. For complex topics, break down explanations into steps
5. Use examples when helpful
6. If the question is unclear, ask for clarification
7. Stay within the context of provided documents
8. Maintain a professional and helpful tone

Remember: Your responses should be based on the provided context and documents.`;
        this.promptTemplates = {
            [this.questionTypes.FACTUAL]: 'Provide a direct and accurate answer based on the following context:',
            [this.questionTypes.ANALYTICAL]: 'Analyze the following information and provide insights:',
            [this.questionTypes.CONCEPTUAL]: 'Explain the concept using the following context:',
            [this.questionTypes.PROCEDURAL]: 'Describe the process or steps based on:',
            [this.questionTypes.CLARIFICATION]: 'To better answer your question, let me clarify based on:'
        };
        this.chatModel = bedrock_1.bedrockService.chatModel;
        this.BATCH_SIZE = 3;
        this.MIN_SIMILARITY_THRESHOLD = 0.3;
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 5000
        };
    }
    isRelevantQuestion(query) {
        return true;
    }
    sanitizeCollectionName(name) {
        return name.replace(/:/g, '-');
    }
    async resolveCollections(modelIdOrCollections) {
        try {
            if (Array.isArray(modelIdOrCollections)) {
                console.log('Collections provided directly:', modelIdOrCollections);
                return modelIdOrCollections;
            }
            console.log('Looking up model by ID:', modelIdOrCollections);
            const model = await Model_1.ModelModel.findById(modelIdOrCollections);
            if (!model) {
                console.error('Model not found:', modelIdOrCollections);
                return [];
            }
            console.log('Found model:', {
                id: model._id,
                name: model.name,
                collections: model.collections
            });
            return model.collections;
        }
        catch (error) {
            console.error('Error resolving collections:', error);
            return [];
        }
    }
    async processBatch(batch, queryEmbedding, imageEmbedding) {
        return Promise.all(batch.map(async (name) => {
            try {
                const queryResult = await chroma_1.chromaService.queryDocumentsWithEmbedding(name, imageEmbedding || queryEmbedding, 5);
                if (!queryResult?.documents || !queryResult?.metadatas) {
                    return { context: '', sources: [] };
                }
                const results = queryResult.documents
                    .map((doc, index) => ({
                    text: doc,
                    metadata: queryResult.metadatas[index],
                    similarity: 1 - (queryResult.distances?.[index] || 0)
                }));
                const similarities = results.map(r => r.similarity);
                const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
                const stdDev = Math.sqrt(similarities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / similarities.length);
                const dynamicThreshold = Math.max(this.MIN_SIMILARITY_THRESHOLD, mean - stdDev);
                const filteredResults = results
                    .filter(result => result.similarity >= dynamicThreshold)
                    .sort((a, b) => b.similarity - a.similarity);
                const sources = filteredResults.map(result => ({
                    modelId: result.metadata.modelId,
                    collectionName: name,
                    filename: result.metadata.filename,
                    similarity: result.similarity
                }));
                return {
                    context: filteredResults.map(r => r.text).join("\n\n"),
                    sources
                };
            }
            catch (error) {
                console.error(`Error querying collection ${name}:`, error);
                return { context: '', sources: [] };
            }
        }));
    }
    detectQuestionType(query) {
        const patterns = {
            [this.questionTypes.FACTUAL]: /^(what|when|where|who|which|how many|how much)/i,
            [this.questionTypes.ANALYTICAL]: /^(why|how|what if|what are the implications|analyze|compare|contrast)/i,
            [this.questionTypes.CONCEPTUAL]: /^(explain|describe|define|what is|what are|how does)/i,
            [this.questionTypes.PROCEDURAL]: /^(how to|how do|what steps|how can|show me how)/i,
            [this.questionTypes.CLARIFICATION]: /^(can you clarify|what do you mean|please explain|could you elaborate)/i
        };
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(query)) {
                return type;
            }
        }
        return this.questionTypes.FACTUAL;
    }
    async getContext(query, modelIdOrCollections, imageBase64) {
        console.log('Getting context for:', {
            query,
            modelIdOrCollections,
            hasImage: !!imageBase64
        });
        const questionType = this.detectQuestionType(query);
        const promptTemplate = this.promptTemplates[questionType];
        const collectionNames = await this.resolveCollections(modelIdOrCollections);
        if (collectionNames.length === 0) {
            console.error('No collections found for:', modelIdOrCollections);
            return '';
        }
        console.log('Resolved collection names:', collectionNames);
        console.log('Detected question type:', questionType);
        const sanitizedCollections = collectionNames.map(name => this.sanitizeCollectionName(name));
        console.log('Sanitized collection names:', sanitizedCollections);
        console.log('Getting query embedding...');
        let queryEmbedding = await chroma_1.chromaService.getQueryEmbedding(query);
        let imageEmbedding;
        if (imageBase64) {
            try {
                console.log('Generating image embedding...');
                imageEmbedding = await bedrock_1.bedrockService.embedImage(imageBase64, query);
                console.log('Generated image embedding');
            }
            catch (error) {
                console.error('Error generating image embedding:', error);
            }
        }
        const batches = [];
        for (let i = 0; i < sanitizedCollections.length; i += this.BATCH_SIZE) {
            batches.push(sanitizedCollections.slice(i, i + this.BATCH_SIZE));
        }
        console.log('Created batches:', batches);
        let allResults = [];
        for (const batch of batches) {
            console.log('Processing batch:', batch);
            const batchResults = await this.processBatch(batch, queryEmbedding, imageEmbedding);
            allResults = allResults.concat(batchResults);
        }
        console.log('All results:', allResults);
        const allSources = allResults
            .flatMap(r => r.sources)
            .sort((a, b) => b.similarity - a.similarity);
        console.log('All sources:', allSources);
        if (this.currentChatHistory) {
            this.currentChatHistory.sources = allSources;
            await this.currentChatHistory.save();
            console.log('Saved sources to chat history');
        }
        const contexts = allResults
            .filter(r => r.sources.length > 0)
            .sort((a, b) => {
            const aMaxSim = Math.max(...a.sources.map(s => s.similarity));
            const bMaxSim = Math.max(...b.sources.map(s => s.similarity));
            return bMaxSim - aMaxSim;
        })
            .map(r => r.context);
        console.log('Final context length:', contexts.join("\n\n").length);
        return `${promptTemplate}\n\n${contexts.join("\n\n")}`;
    }
    async *generateResponse(messages, query, modelId, collectionName) {
        try {
            console.log('Starting generateResponse:', {
                modelId,
                collectionName,
                messagesCount: messages.length,
                query
            });
            if (!this.isRelevantQuestion(query)) {
                console.log('Query not relevant');
                yield 'Sorry, I can only answer questions about Mae Fah Luang University.';
                return;
            }
            console.log('Getting context for query:', query);
            const context = await this.getContext(query, collectionName);
            console.log('Retrieved context length:', context.length);
            const augmentedMessages = [
                {
                    role: 'system',
                    content: `${this.systemPrompt}\n\nContext from documents:\n${context}`
                },
                ...messages
            ];
            for await (const chunk of bedrock_1.bedrockService.chat(augmentedMessages, modelId)) {
                yield chunk;
            }
        }
        catch (error) {
            console.error('Error in generateResponse:', error);
            throw error;
        }
    }
    async retryOperation(operation, errorMessage) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                console.error(`${errorMessage} (Attempt ${attempt}/${this.retryConfig.maxRetries}):`, error);
                if (attempt < this.retryConfig.maxRetries) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw new Error(`${errorMessage} after ${this.retryConfig.maxRetries} attempts: ${lastError?.message}`);
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
    console.log('Debug message');
}
