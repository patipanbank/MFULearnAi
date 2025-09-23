"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realEmbeddingService = exports.RealEmbeddingService = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const credential_provider_env_1 = require("@aws-sdk/credential-provider-env");
class RealEmbeddingService {
    constructor(options = {}) {
        this.cache = new Map();
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: (0, credential_provider_env_1.fromEnv)(),
            maxAttempts: 3
        });
        this.options = {
            model: options.model || 'amazon.titan-embed-text-v1',
            dimensions: options.dimensions || 1536,
            maxRetries: options.maxRetries || 3
        };
        console.log(`🔧 Real Embedding Service initialized with model: ${this.options.model}`);
    }
    async embed(text, options) {
        if (!text || text.trim().length === 0) {
            console.warn('⚠️ Empty text provided for embedding');
            return [];
        }
        const cacheKey = this.getCacheKey(text);
        if (this.cache.has(cacheKey)) {
            console.log('📋 Returning cached embedding');
            return this.cache.get(cacheKey);
        }
        const effectiveOptions = { ...this.options, ...options };
        let lastError = null;
        for (let attempt = 1; attempt <= effectiveOptions.maxRetries; attempt++) {
            try {
                console.log(`🔄 Generating embedding (attempt ${attempt}/${effectiveOptions.maxRetries})`);
                const embedding = await this.generateEmbedding(text, effectiveOptions);
                this.cache.set(cacheKey, embedding);
                if (this.cache.size > 1000) {
                    const firstKey = this.cache.keys().next().value;
                    if (firstKey) {
                        this.cache.delete(firstKey);
                    }
                }
                console.log(`✅ Embedding generated successfully (${embedding.length} dimensions)`);
                return embedding;
            }
            catch (error) {
                lastError = error;
                console.error(`❌ Embedding attempt ${attempt} failed:`, error);
                if (attempt < effectiveOptions.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw new Error(`Failed to generate embedding after ${effectiveOptions.maxRetries} attempts: ${lastError?.message}`);
    }
    async embedBatch(texts, options) {
        console.log(`📦 Generating embeddings for ${texts.length} texts`);
        const embeddings = [];
        const batchSize = 5;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
            const batchPromises = batch.map(text => this.embed(text, options));
            const batchResults = await Promise.all(batchPromises);
            embeddings.push(...batchResults);
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        console.log(`✅ Generated ${embeddings.length} embeddings`);
        return embeddings;
    }
    async generateEmbedding(text, options) {
        const body = {
            inputText: text.trim()
        };
        const command = new client_bedrock_runtime_1.InvokeModelCommand({
            modelId: options.model,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(body)
        });
        const response = await this.client.send(command);
        if (!response.body) {
            throw new Error('No response body from Bedrock API');
        }
        const responseBody = JSON.parse(Buffer.from(response.body).toString());
        if (!responseBody.embedding) {
            throw new Error('No embedding in response from Bedrock API');
        }
        const embedding = responseBody.embedding;
        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error('Invalid embedding format from Bedrock API');
        }
        if (embedding.length !== this.getExpectedDimensions(options.model)) {
            console.warn(`⚠️ Unexpected embedding dimensions: got ${embedding.length}, expected ${this.getExpectedDimensions(options.model)}`);
        }
        return embedding;
    }
    getExpectedDimensions(model) {
        const dimensionMap = {
            'amazon.titan-embed-text-v1': 1536,
            'amazon.titan-embed-text-v2:0': 1024,
            'cohere.embed-english-v3': 1024,
            'cohere.embed-multilingual-v3': 1024
        };
        return dimensionMap[model] || 1536;
    }
    getCacheKey(text) {
        return Buffer.from(text).toString('base64').slice(0, 50);
    }
    calculateSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same dimensions');
        }
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    findMostSimilar(queryEmbedding, candidateEmbeddings, topK = 5) {
        const similarities = candidateEmbeddings.map((embedding, index) => ({
            index,
            similarity: this.calculateSimilarity(queryEmbedding, embedding)
        }));
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }
    clearCache() {
        this.cache.clear();
        console.log('🧹 Embedding cache cleared');
    }
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()).slice(0, 10)
        };
    }
    async healthCheck() {
        try {
            const testEmbedding = await this.embed('test', { maxRetries: 1 });
            return testEmbedding.length > 0;
        }
        catch (error) {
            console.error('❌ Embedding service health check failed:', error);
            return false;
        }
    }
}
exports.RealEmbeddingService = RealEmbeddingService;
exports.realEmbeddingService = new RealEmbeddingService({
    model: 'amazon.titan-embed-text-v1',
    dimensions: 1536,
    maxRetries: 3
});
console.log('🚀 Real Embedding Service instance created');
//# sourceMappingURL=realEmbeddingService.js.map