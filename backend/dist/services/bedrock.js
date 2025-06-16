"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bedrockService = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
class BedrockService {
    constructor() {
        this.chatModel = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
        this.models = {
            claude35: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            titanImage: 'amazon.titan-image-generator-v1',
            titan: 'amazon.titan-embed-text-v1'
        };
        this.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
        this.bedrockRuntimeClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: this.AWS_REGION });
    }
    setChatModel(modelId) {
        if (Object.values(this.models).includes(modelId)) {
            this.chatModel = modelId;
        }
        else {
            console.warn(`Model ID "${modelId}" is not in the list of available models. Using default.`);
            this.chatModel = this.models.claude35;
        }
    }
    async invokeModelJSON(prompt, modelId = this.chatModel) {
        const response = await this.bedrockRuntimeClient.send(new client_bedrock_runtime_1.InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                top_p: 0.9,
            }),
        }));
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const assistantResponse = responseBody.content.find((c) => c.type === 'text')?.text || '';
        try {
            return JSON.parse(assistantResponse);
        }
        catch (error) {
            console.error("Error parsing JSON from model response:", assistantResponse);
            throw new Error("Failed to parse JSON from model response.");
        }
    }
    async invokeForText(prompt, modelId = this.models.claude35, max_tokens = 2048) {
        const response = await this.bedrockRuntimeClient.send(new client_bedrock_runtime_1.InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: max_tokens,
                messages: [{ role: 'user', content: prompt }],
            }),
        }));
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        return responseBody.content.find((c) => c.type === 'text')?.text || '';
    }
    async converse(input) {
        const command = new client_bedrock_runtime_1.ConverseCommand(input);
        const response = await this.bedrockRuntimeClient.send(command);
        return response;
    }
    async *converseStream(input) {
        const command = new client_bedrock_runtime_1.ConverseStreamCommand(input);
        const responseStream = await this.bedrockRuntimeClient.send(command);
        if (responseStream.stream) {
            for await (const chunk of responseStream.stream) {
                yield chunk;
            }
        }
    }
}
exports.bedrockService = new BedrockService();
