"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM = void 0;
exports.getLLM = getLLM;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const credential_provider_env_1 = require("@aws-sdk/credential-provider-env");
const aws_1 = require("@langchain/aws");
const messages_1 = require("@langchain/core/messages");
class LLM {
    constructor(modelId, options = {}) {
        this.langchainModel = null;
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION,
            credentials: (0, credential_provider_env_1.fromEnv)(),
            maxAttempts: 3,
        });
        this.modelId = modelId;
        this.options = options;
        this.langchainModel = new aws_1.ChatBedrockConverse({
            model: modelId,
            region: process.env.AWS_REGION,
            credentials: (0, credential_provider_env_1.fromEnv)(),
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            additionalModelRequestFields: options.topK || options.model_kwargs ? {
                ...(options.topK && { top_k: options.topK }),
                ...options.model_kwargs,
            } : undefined,
        });
    }
    async generate(prompt) {
        if (!this.langchainModel) {
            throw new Error('LangChain model not initialized');
        }
        try {
            const messages = [];
            if (this.options.systemPrompt) {
                messages.push(new messages_1.SystemMessage(this.options.systemPrompt));
            }
            messages.push(new messages_1.HumanMessage(prompt));
            const response = await this.langchainModel.invoke(messages);
            return response.content;
        }
        catch (error) {
            console.warn('LangChain failed, falling back to direct Bedrock API:', error);
            return this.generateWithBedrockAPI(prompt);
        }
    }
    async generateWithBedrockAPI(prompt) {
        const allowedParams = {
            temperature: 'temperature',
            topP: 'top_p',
            topK: 'top_k',
        };
        const model_kwargs = {};
        for (const [camel, snake] of Object.entries(allowedParams)) {
            if (this.options[camel] !== undefined) {
                model_kwargs[snake] = this.options[camel];
            }
        }
        const isClaude35 = this.modelId.startsWith('anthropic.claude-3-5-') || this.modelId.startsWith('anthropic.claude-3-sonnet-20240229');
        if (isClaude35) {
            const messages = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt }
                    ]
                }
            ];
            const body = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: this.options.maxTokens ?? 1024,
                messages,
            };
            if (this.options.systemPrompt)
                body.system = this.options.systemPrompt;
            if (this.options.temperature !== undefined)
                body.temperature = this.options.temperature;
            if (this.options.topP !== undefined)
                body.top_p = this.options.topP;
            if (this.options.topK !== undefined)
                body.top_k = this.options.topK;
            if (this.options.tools !== undefined)
                body.tools = this.options.tools;
            if (this.options.tool_choice !== undefined)
                body.tool_choice = this.options.tool_choice;
            if (this.options.stop_sequences !== undefined)
                body.stop_sequences = this.options.stop_sequences;
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: this.modelId,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            if (Array.isArray(responseBody.content)) {
                const textBlock = responseBody.content.find((c) => c.type === 'text' && typeof c.text === 'string');
                if (textBlock)
                    return textBlock.text;
            }
            if (responseBody.completion && typeof responseBody.completion === 'string')
                return responseBody.completion;
            return JSON.stringify(responseBody);
        }
        let body = {};
        if (this.modelId.startsWith('anthropic.')) {
            let formattedPrompt = '';
            if (this.options.systemPrompt) {
                formattedPrompt += `System: ${this.options.systemPrompt}\n\n`;
            }
            formattedPrompt += `Human: ${prompt}\n\nAssistant:`;
            body = {
                prompt: formattedPrompt,
                max_tokens_to_sample: this.options.maxTokens ?? 4000,
                ...model_kwargs,
            };
        }
        else if (this.modelId.startsWith('amazon.titan')) {
            body = {
                inputText: prompt,
                maxTokenCount: this.options.maxTokens ?? 4000,
                ...model_kwargs,
            };
        }
        else if (this.modelId.startsWith('meta.llama')) {
            body = {
                prompt,
                max_gen_len: this.options.maxTokens ?? 4000,
                ...model_kwargs,
            };
        }
        else {
            body = {
                prompt,
                max_tokens: this.options.maxTokens ?? 4000,
                ...model_kwargs,
            };
        }
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
        if (!this.langchainModel) {
            throw new Error('LangChain model not initialized');
        }
        try {
            const messages = [];
            if (this.options.systemPrompt) {
                messages.push(new messages_1.SystemMessage(this.options.systemPrompt));
            }
            messages.push(new messages_1.HumanMessage(prompt));
            const stream = await this.langchainModel.stream(messages);
            for await (const chunk of stream) {
                if (chunk.content) {
                    yield chunk.content;
                }
            }
        }
        catch (error) {
            console.warn('LangChain streaming failed, falling back to direct Bedrock API:', error);
            yield* this.streamWithBedrockAPI(prompt);
        }
    }
    async *streamWithBedrockAPI(prompt) {
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