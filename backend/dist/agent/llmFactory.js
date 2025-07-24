"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM = void 0;
exports.getLLM = getLLM;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const credential_provider_env_1 = require("@aws-sdk/credential-provider-env");
class LLM {
    constructor(modelId, options = {}) {
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION,
            credentials: (0, credential_provider_env_1.fromEnv)(),
            maxAttempts: 3,
        });
        this.modelId = modelId;
        this.options = options;
    }
    async generate(prompt) {
        const model_kwargs = { ...this.options.model_kwargs };
        for (const param of ['temperature', 'maxTokens', 'topP', 'topK']) {
            if (this.options[param] !== undefined) {
                if (param === 'maxTokens')
                    model_kwargs['maxTokenCount'] = this.options[param];
                else
                    model_kwargs[param] = this.options[param];
            }
        }
        for (const key of Object.keys(this.options)) {
            if (!['streaming', 'temperature', 'maxTokens', 'topP', 'topK', 'model_kwargs'].includes(key)) {
                model_kwargs[key] = this.options[key];
            }
        }
        const body = { inputText: prompt, ...model_kwargs };
        const command = new client_bedrock_runtime_1.InvokeModelCommand({
            modelId: this.modelId,
            body: JSON.stringify(body),
            contentType: 'application/json',
            accept: 'application/json',
        });
        const response = await this.client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        if (responseBody.results && responseBody.results[0]?.outputText) {
            return responseBody.results[0].outputText;
        }
        if (responseBody.completion) {
            return responseBody.completion;
        }
        return JSON.stringify(responseBody);
    }
    async *stream(prompt) {
        const modelId = this.modelId;
        const messages = [
            {
                role: 'user',
                content: [{ type: 'text', text: prompt }],
            },
        ];
        const inferenceConfig = {};
        if (this.options.maxTokens !== undefined)
            inferenceConfig.maxTokens = this.options.maxTokens;
        if (this.options.temperature !== undefined)
            inferenceConfig.temperature = this.options.temperature;
        if (this.options.topP !== undefined)
            inferenceConfig.topP = this.options.topP;
        const command = new client_bedrock_runtime_1.ConverseStreamCommand({
            modelId,
            messages,
            inferenceConfig,
        });
        const response = await this.client.send(command);
        if (!response.stream) {
            return;
        }
        for await (const item of response.stream) {
            if (item.contentBlockDelta) {
                const text = item.contentBlockDelta.delta?.text;
                if (text)
                    yield text;
            }
        }
    }
}
exports.LLM = LLM;
function getLLM(modelId, options = {}) {
    return new LLM(modelId, options);
}
//# sourceMappingURL=llmFactory.js.map