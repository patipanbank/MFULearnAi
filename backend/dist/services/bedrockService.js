"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bedrockService = exports.BedrockService = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const client_bedrock_1 = require("@aws-sdk/client-bedrock");
class BedrockService {
    constructor() {
        const region = process.env.AWS_REGION || 'us-east-1';
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        if (!accessKeyId || !secretAccessKey) {
            throw new Error('AWS credentials not configured');
        }
        this.bedrockRuntimeClient = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        this.bedrockClient = new client_bedrock_1.BedrockClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        this.defaultModelId = process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    }
    async createTextEmbedding(text, modelId) {
        const model = modelId || 'amazon.titan-embed-text-v1';
        const body = { inputText: text };
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: model,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.bedrockRuntimeClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.embedding;
        }
        catch (error) {
            console.error('Failed to create text embedding:', error);
            return [];
        }
    }
    async createBatchTextEmbeddings(texts, modelId) {
        const promises = texts.map(text => this.createTextEmbedding(text, modelId));
        return Promise.all(promises);
    }
    async createImageEmbedding(imageBase64, text, modelId) {
        const model = modelId || 'amazon.titan-embed-image-v1';
        const body = { inputImage: imageBase64 };
        if (text) {
            body.inputText = text;
        }
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: model,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.bedrockRuntimeClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.embedding;
        }
        catch (error) {
            console.error('Failed to create image embedding:', error);
            return [];
        }
    }
    async generateImage(prompt, width = 1024, height = 1024, quality = 'standard') {
        const modelId = 'amazon.titan-image-generator-v1';
        const body = {
            taskType: 'TEXT_IMAGE',
            textToImageParams: { text: prompt },
            imageGenerationConfig: {
                numberOfImages: 1,
                quality,
                height,
                width,
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
            const response = await this.bedrockRuntimeClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.images[0];
        }
        catch (error) {
            console.error('Failed to generate image:', error);
            return '';
        }
    }
    async *converseStream(modelId, messages, systemPrompt = '', toolConfig, temperature, topP) {
        const model = modelId || this.defaultModelId;
        const inferenceConfig = {};
        if (temperature !== undefined) {
            inferenceConfig.temperature = temperature;
        }
        if (topP !== undefined) {
            inferenceConfig.topP = topP;
        }
        const systemMessages = systemPrompt ? [{ text: systemPrompt }] : [];
        try {
            const command = new client_bedrock_runtime_1.ConverseStreamCommand({
                modelId: model,
                messages,
                system: systemMessages,
                toolConfig,
                inferenceConfig,
            });
            const response = await this.bedrockRuntimeClient.send(command);
            const stream = response.stream;
            if (stream) {
                for await (const event of stream) {
                    yield event;
                }
            }
        }
        catch (error) {
            console.error('Error during Bedrock converse_stream:', error);
            yield { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    async healthCheck() {
        try {
            const command = new client_bedrock_1.ListFoundationModelsCommand({});
            await this.bedrockClient.send(command);
            return {
                status: 'healthy',
                service: 'bedrock',
                timestamp: new Date().toISOString(),
                region: process.env.AWS_REGION,
                defaultModel: this.defaultModelId,
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                service: 'bedrock',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            };
        }
    }
    async listModels() {
        try {
            const command = new client_bedrock_1.ListFoundationModelsCommand({});
            const response = await this.bedrockClient.send(command);
            return response.modelSummaries?.map(model => model.modelId || '') || [];
        }
        catch (error) {
            console.error('Failed to list models:', error);
            return [];
        }
    }
}
exports.BedrockService = BedrockService;
exports.bedrockService = new BedrockService();
//# sourceMappingURL=bedrockService.js.map