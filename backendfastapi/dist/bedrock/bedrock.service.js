"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BedrockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const client_bedrock_agent_runtime_1 = require("@aws-sdk/client-bedrock-agent-runtime");
let BedrockService = BedrockService_1 = class BedrockService {
    configService;
    logger = new common_1.Logger(BedrockService_1.name);
    bedrockClient;
    bedrockAgentClient;
    constructor(configService) {
        this.configService = configService;
        this.initializeBedrockClients();
    }
    initializeBedrockClients() {
        const region = this.configService.get('AWS_REGION') || 'us-east-1';
        const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
        if (!accessKeyId || !secretAccessKey) {
            this.logger.warn('AWS credentials not found, Bedrock service will not work properly');
        }
        this.bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId: accessKeyId || '',
                secretAccessKey: secretAccessKey || '',
            },
        });
        this.bedrockAgentClient = new client_bedrock_agent_runtime_1.BedrockAgentRuntimeClient({
            region,
            credentials: {
                accessKeyId: accessKeyId || '',
                secretAccessKey: secretAccessKey || '',
            },
        });
    }
    async createTextEmbedding(text) {
        const modelId = 'amazon.titan-embed-text-v1';
        const body = { inputText: text };
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.embedding;
        }
        catch (error) {
            this.logger.error(`Failed to create text embedding: ${error}`);
            return [];
        }
    }
    async createBatchTextEmbeddings(texts) {
        const tasks = texts.map(text => this.createTextEmbedding(text));
        return Promise.all(tasks);
    }
    async createImageEmbedding(imageBase64, text) {
        const modelId = 'amazon.titan-embed-image-v1';
        const body = { inputImage: imageBase64 };
        if (text) {
            body.inputText = text;
        }
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.embedding;
        }
        catch (error) {
            this.logger.error(`Failed to create image embedding: ${error}`);
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
            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.images[0];
        }
        catch (error) {
            this.logger.error(`Failed to generate image: ${error}`);
            return '';
        }
    }
    async *converseStream(modelId, messages, systemPrompt, toolConfig, temperature, topP) {
        if (!modelId) {
            modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
        }
        const inferenceConfig = {};
        if (temperature !== undefined) {
            inferenceConfig.temperature = temperature;
        }
        if (topP !== undefined) {
            inferenceConfig.topP = topP;
        }
        const sdkMessages = messages.map(m => ({
            role: m.role === 'system' ? client_bedrock_runtime_1.ConversationRole.USER : m.role,
            content: [{ text: m.content }],
        }));
        const systemMessages = systemPrompt
            ? [{ text: systemPrompt }]
            : [];
        const sdkToolConfig = toolConfig && toolConfig.tools ? toolConfig : { tools: [] };
        try {
            const command = new client_bedrock_runtime_1.ConverseStreamCommand({
                modelId,
                messages: sdkMessages,
                system: systemMessages,
                toolConfig: sdkToolConfig,
                inferenceConfig,
            });
            const response = await this.bedrockClient.send(command);
            const stream = response.stream;
            if (stream) {
                for await (const event of stream) {
                    yield event;
                }
            }
        }
        catch (error) {
            this.logger.error(`Error during Bedrock converse_stream for model ${modelId}: ${error}`);
            yield { error: String(error) };
        }
    }
    async invokeAgent(agentId, agentAliasId, sessionId, input) {
        try {
            const command = new client_bedrock_agent_runtime_1.InvokeAgentCommand({
                agentId,
                agentAliasId,
                sessionId,
                inputText: input.text,
            });
            const response = await this.bedrockAgentClient.send(command);
            return response;
        }
        catch (error) {
            this.logger.error(`Error invoking agent ${agentId}: ${error}`);
            throw error;
        }
    }
    getModelDimension(modelId) {
        const dimensions = {
            'amazon.titan-embed-text-v1': 1536,
            'amazon.titan-embed-image-v1': 1024,
            'amazon.titan-embed-text-v2': 1536,
        };
        return dimensions[modelId] || 1536;
    }
    async generateEmbedding(text, modelId = 'amazon.titan-embed-text-v1') {
        return this.createTextEmbedding(text);
    }
    async generateBatchEmbeddings(texts, modelId = 'amazon.titan-embed-text-v1') {
        return this.createBatchTextEmbeddings(texts);
    }
};
exports.BedrockService = BedrockService;
exports.BedrockService = BedrockService = BedrockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], BedrockService);
//# sourceMappingURL=bedrock.service.js.map