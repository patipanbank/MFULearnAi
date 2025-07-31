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
    async createBatchTextEmbeddings(texts) {
        try {
            const embeddings = [];
            for (const text of texts) {
                const embedding = await this.createTextEmbedding(text);
                embeddings.push(embedding);
            }
            return embeddings;
        }
        catch (error) {
            console.error('Error creating batch embeddings:', error);
            throw error;
        }
    }
    async createTextEmbedding(text) {
        try {
            const input = {
                inputText: text,
            };
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: 'amazon.titan-embed-text-v1',
                contentType: 'application/json',
                body: JSON.stringify(input),
            });
            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.embedding;
        }
        catch (error) {
            console.error('Error creating text embedding:', error);
            return new Array(384).fill(0);
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