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
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
let BedrockService = BedrockService_1 = class BedrockService {
    constructor() {
        this.logger = new common_1.Logger(BedrockService_1.name);
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: process.env.AWS_ACCESS_KEY_ID
                ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                }
                : undefined,
        });
    }
    async createTextEmbedding(text) {
        var _a;
        const modelId = 'amazon.titan-embed-text-v1';
        try {
            const cmd = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: Buffer.from(JSON.stringify({ inputText: text })),
            });
            const response = await this.client.send(cmd);
            const json = JSON.parse(Buffer.from(response.body).toString('utf8'));
            return (_a = json.embedding) !== null && _a !== void 0 ? _a : [];
        }
        catch (err) {
            this.logger.error(`createTextEmbedding error: ${err}`);
            return [];
        }
    }
    async createBatchTextEmbeddings(texts) {
        return Promise.all(texts.map((t) => this.createTextEmbedding(t)));
    }
    async generateImage(prompt) {
        var _a, _b;
        const modelId = 'amazon.titan-image-generator-v1';
        try {
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
            const cmd = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: Buffer.from(JSON.stringify(body)),
            });
            const res = await this.client.send(cmd);
            const json = JSON.parse(Buffer.from(res.body).toString('utf8'));
            return (_b = (_a = json.images) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '';
        }
        catch (err) {
            this.logger.error(`generateImage error: ${err}`);
            return '';
        }
    }
    async converseStream({ modelId, messages, systemPrompt, toolConfig, temperature, topP, maxTokens, }) {
        const gatewayUrl = process.env.BEDROCK_GATEWAY_URL ||
            'http://localhost:5001/api/v1/bedrock/converse-stream';
        const axios = (await Promise.resolve().then(() => require('axios'))).default;
        const readline = await Promise.resolve().then(() => require('readline'));
        const payload = {
            model_id: modelId,
            messages,
        };
        if (systemPrompt)
            payload.system_prompt = systemPrompt;
        if (toolConfig)
            payload.tool_config = toolConfig;
        if (temperature !== undefined)
            payload.temperature = temperature;
        if (topP !== undefined)
            payload.top_p = topP;
        if (maxTokens !== undefined)
            payload.max_tokens = maxTokens;
        this.logger.debug(`Starting converseStream via gateway: ${gatewayUrl}`);
        let responseStream;
        try {
            const res = await axios.post(gatewayUrl, payload, {
                responseType: 'stream',
                headers: { 'Content-Type': 'application/json' },
            });
            responseStream = res.data;
        }
        catch (err) {
            this.logger.error(`converseStream request error: ${err}`);
            throw err;
        }
        const rl = readline.createInterface({ input: responseStream });
        async function* streamGenerator() {
            try {
                for await (const line of rl) {
                    if (!line.trim())
                        continue;
                    try {
                        yield JSON.parse(line);
                    }
                    catch (parseErr) {
                        yield { type: 'chunk', data: line };
                    }
                }
            }
            finally {
                rl.close();
            }
        }
        return streamGenerator();
    }
    async embed(text) {
        return this.createTextEmbedding(text);
    }
};
exports.BedrockService = BedrockService;
exports.BedrockService = BedrockService = BedrockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], BedrockService);
//# sourceMappingURL=bedrock.service.js.map