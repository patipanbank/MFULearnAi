"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bedrockService = exports.BedrockService = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
class BedrockService {
    constructor() {
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'us-east-1',
        });
    }
    async createBatchTextEmbeddings(texts, onProgress) {
        if (!texts || texts.length === 0) {
            return [];
        }
        console.log(`🔮 Starting batch embedding for ${texts.length} texts`);
        try {
            if (texts.length > 50) {
                return await this.createLargeBatchEmbeddings(texts, onProgress);
            }
            return await this.createParallelEmbeddings(texts, onProgress);
        }
        catch (error) {
            console.error('Error creating batch embeddings:', error);
            throw error;
        }
    }
    async createLargeBatchEmbeddings(texts, onProgress) {
        const BATCH_SIZE = 10;
        const DELAY_BETWEEN_BATCHES = 200;
        const allEmbeddings = [];
        let completed = 0;
        console.log(`📦 Processing ${texts.length} texts in batches of ${BATCH_SIZE}`);
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            try {
                console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`);
                const batchEmbeddings = await this.createParallelEmbeddings(batch);
                allEmbeddings.push(...batchEmbeddings);
                completed += batch.length;
                onProgress?.(completed, texts.length);
                if (i + BATCH_SIZE < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            }
            catch (error) {
                console.error(`❌ Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
                console.log(`🔄 Retrying batch ${Math.floor(i / BATCH_SIZE) + 1} sequentially`);
                const fallbackEmbeddings = await this.createSequentialEmbeddings(batch);
                allEmbeddings.push(...fallbackEmbeddings);
                completed += batch.length;
                onProgress?.(completed, texts.length);
            }
        }
        console.log(`✅ Completed batch embedding: ${allEmbeddings.length} embeddings`);
        return allEmbeddings;
    }
    async createParallelEmbeddings(texts, onProgress) {
        const MAX_CONCURRENT = 5;
        const embeddings = [];
        let completed = 0;
        for (let i = 0; i < texts.length; i += MAX_CONCURRENT) {
            const chunk = texts.slice(i, i + MAX_CONCURRENT);
            const chunkPromises = chunk.map(async (text, index) => {
                try {
                    const embedding = await this.createTextEmbedding(text);
                    return { index: i + index, embedding, success: true };
                }
                catch (error) {
                    console.warn(`⚠️ Failed to embed text ${i + index}, will retry`);
                    return { index: i + index, embedding: null, success: false, error };
                }
            });
            const chunkResults = await Promise.allSettled(chunkPromises);
            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    const { index, embedding, success } = result.value;
                    if (success && embedding) {
                        embeddings[index] = embedding;
                    }
                    else {
                        try {
                            console.log(`🔄 Retrying embedding for index ${index}`);
                            const retryEmbedding = await this.createTextEmbedding(texts[index]);
                            embeddings[index] = retryEmbedding;
                        }
                        catch (retryError) {
                            console.error(`❌ Final failure for text ${index}:`, retryError);
                            throw new Error(`Failed to create embedding for text at index ${index}`);
                        }
                    }
                }
                else {
                    throw new Error(`Chunk processing failed: ${result.reason}`);
                }
                completed++;
                onProgress?.(completed, texts.length);
            }
        }
        return embeddings.filter(e => e);
    }
    async createSequentialEmbeddings(texts) {
        const embeddings = [];
        for (let i = 0; i < texts.length; i++) {
            try {
                console.log(`🔄 Sequential embedding ${i + 1}/${texts.length}`);
                const embedding = await this.createTextEmbedding(texts[i]);
                embeddings.push(embedding);
                if (i < texts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            catch (error) {
                console.error(`❌ Failed to create embedding ${i + 1}:`, error);
                throw error;
            }
        }
        return embeddings;
    }
    async createTextEmbedding(text) {
        try {
            console.log('🔮 Creating embedding for text:', text.substring(0, 100) + '...');
            if (!text || text.trim().length === 0) {
                throw new Error('Empty text provided for embedding');
            }
            const maxLength = 25000;
            const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
            if (text.length !== truncatedText.length) {
                console.warn(`⚠️ Text truncated from ${text.length} to ${truncatedText.length} characters`);
            }
            const input = {
                inputText: truncatedText,
            };
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: 'amazon.titan-embed-text-v1',
                contentType: 'application/json',
                body: JSON.stringify(input),
            });
            const response = await this.client.send(command);
            if (!response.body) {
                throw new Error('Empty response from Bedrock');
            }
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
                throw new Error('Invalid embedding response format');
            }
            console.log('✅ Embedding created successfully, dimension:', responseBody.embedding.length);
            return responseBody.embedding;
        }
        catch (error) {
            console.error('❌ Error creating text embedding:', {
                message: error instanceof Error ? error.message : error,
                name: error instanceof Error ? error.name : 'Unknown',
                code: error.code || 'Unknown',
                statusCode: error.$metadata?.httpStatusCode
            });
            if (error.name === 'ThrottlingException') {
                throw new Error('Bedrock service is throttled. Please try again later.');
            }
            if (error.name === 'ValidationException') {
                throw new Error('Invalid input for embedding model.');
            }
            if (error.name === 'AccessDeniedException') {
                throw new Error('Access denied to Bedrock service. Check AWS credentials.');
            }
            if (error.name === 'ServiceUnavailableException') {
                throw new Error('Bedrock service is temporarily unavailable.');
            }
            if (process.env.NODE_ENV === 'development') {
                console.log('⚠️ Development mode: Returning dummy embedding with 1536 dimensions');
                return new Array(1536).fill(0.001);
            }
            throw error;
        }
    }
    async createImageEmbedding(imageBase64, text) {
        const modelId = 'amazon.titan-embed-image-v1';
        const body = { inputImage: imageBase64 };
        if (text)
            body.inputText = text;
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.embedding;
        }
        catch (error) {
            console.error('Failed to create image embedding:', error);
            return [];
        }
    }
    async generateImage(prompt) {
        const modelId = 'amazon.titan-image-generator-v1';
        const body = {
            taskType: 'TEXT_IMAGE',
            textToImageParams: { text: prompt },
            imageGenerationConfig: {
                numberOfImages: 1,
                quality: 'standard',
                height: 1024,
                width: 1024,
                cfgScale: 8.0,
                seed: 0,
            },
        };
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.images?.[0] || '';
        }
        catch (error) {
            console.error('Failed to generate image:', error);
            return '';
        }
    }
    async *converseStream(modelId, messages, systemPrompt, toolConfig, temperature, topP) {
        const body = {
            messages,
            system: systemPrompt ? [{ text: systemPrompt }] : [],
            toolConfig,
            inferenceConfig: {},
        };
        if (temperature !== undefined)
            body.inferenceConfig.temperature = temperature;
        if (topP !== undefined)
            body.inferenceConfig.topP = topP;
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            yield responseBody;
        }
        catch (error) {
            console.error('Error during converseStream:', error);
            yield { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}
exports.BedrockService = BedrockService;
exports.bedrockService = new BedrockService();
//# sourceMappingURL=bedrockService.js.map