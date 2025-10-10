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
        // สร้าง LangChain model instance
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
    /**
     * สร้าง multimodal messages สำหรับ Bedrock API
     * รองรับทั้งข้อความและรูปภาพ
     */
    buildMultimodalMessages(prompt, images) {
        const messages = [];
        // เริ่มต้นด้วยข้อความ
        if (prompt.trim()) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: prompt }
                ]
            });
        }
        // เพิ่มรูปภาพถ้ามี
        if (images && images.length > 0) {
            // ถ้าไม่มีข้อความ ให้สร้าง user message ใหม่
            if (!prompt.trim()) {
                messages.push({
                    role: 'user',
                    content: []
                });
            }
            // เพิ่มรูปภาพเข้า content ของ user message ล่าสุด
            const lastMessage = messages[messages.length - 1];
            for (const image of images) {
                if (image.base64Data) {
                    lastMessage.content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: image.mediaType,
                            data: image.base64Data
                        }
                    });
                }
            }
        }
        return messages;
    }
    /**
     * Generate text from prompt using LangChain Bedrock LLM
     * - ใช้ LangChain ChatBedrock แทนการ implement เอง
     * - รองรับ system prompt และ message format
     * - เพิ่มการรองรับ multimodal (รูปภาพ)
     */
    async generate(prompt, images) {
        console.log(`🤖 LLM.generate called with prompt length: ${prompt.length}, images: ${images?.length || 0}`);
        if (!this.langchainModel) {
            throw new Error('LangChain model not initialized');
        }
        try {
            const messages = [];
            // เพิ่ม system message ถ้ามี
            if (this.options.systemPrompt) {
                console.log(`🤖 Adding system prompt: ${this.options.systemPrompt.substring(0, 50)}...`);
                messages.push(new messages_1.SystemMessage(this.options.systemPrompt));
            }
            // เพิ่ม user message (รองรับ multimodal)
            if (images && images.length > 0 && images.some(img => img.base64Data)) {
                // ใช้ multimodal approach สำหรับ Bedrock
                console.log(`🤖 Using multimodal approach with ${images.length} images`);
                return this.generateWithBedrockMultimodal(prompt, images);
            }
            else {
                // ใช้ LangChain approach แบบเดิม
                console.log(`🤖 Adding user message: ${prompt.substring(0, 50)}...`);
                messages.push(new messages_1.HumanMessage(prompt));
            }
            // เรียก LangChain model
            console.log(`🤖 Calling LangChain model.invoke...`);
            const response = await this.langchainModel.invoke(messages);
            console.log(`🤖 LangChain response received: ${response.content.substring(0, 100)}...`);
            return response.content;
        }
        catch (error) {
            // Fallback ไปใช้ Bedrock API เดิมถ้า LangChain มีปัญหา
            console.warn('LangChain failed, falling back to direct Bedrock API:', error);
            return this.generateWithBedrockAPI(prompt, images);
        }
    }
    /**
     * ใช้ Bedrock Multimodal API สำหรับโมเดลที่รองรับ (เช่น Claude 3.5)
     */
    async generateWithBedrockMultimodal(prompt, images) {
        try {
            console.log(`🖼️ generateWithBedrockMultimodal called - prompt: ${prompt.substring(0, 50)}...`);
            console.log(`🖼️ Images for processing: ${images.length} total, ${images.filter(img => img.base64Data).length} with base64 data`);
            const messages = this.buildMultimodalMessages(prompt, images);
            console.log(`📨 Built ${messages.length} multimodal messages`);
            const body = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: this.options.maxTokens ?? 1024,
                messages,
            };
            if (this.options.systemPrompt) {
                body.system = this.options.systemPrompt;
                console.log(`🤖 Added system prompt: ${this.options.systemPrompt.substring(0, 50)}...`);
            }
            if (this.options.temperature !== undefined)
                body.temperature = this.options.temperature;
            if (this.options.topP !== undefined)
                body.top_p = this.options.topP;
            if (this.options.topK !== undefined)
                body.top_k = this.options.topK;
            console.log(`🚀 Sending multimodal request to model: ${this.modelId}`);
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: this.modelId,
                body: JSON.stringify(body),
                contentType: 'application/json',
                accept: 'application/json',
            });
            console.log(`⏳ Awaiting Bedrock response...`);
            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            console.log(`✅ Received response from Bedrock:`, {
                hasContent: !!responseBody.content,
                contentType: Array.isArray(responseBody.content) ? 'array' : typeof responseBody.content,
                hasCompletion: !!responseBody.completion
            });
            // Claude 3.5: content is array of blocks, find first text block
            if (Array.isArray(responseBody.content)) {
                const textBlock = responseBody.content.find((c) => c.type === 'text' && typeof c.text === 'string');
                if (textBlock) {
                    console.log(`📝 Extracted text response: ${textBlock.text.substring(0, 100)}...`);
                    return textBlock.text;
                }
            }
            if (responseBody.completion && typeof responseBody.completion === 'string') {
                console.log(`📝 Using completion response: ${responseBody.completion.substring(0, 100)}...`);
                return responseBody.completion;
            }
            console.warn(`⚠️ Unexpected response format, returning JSON string`);
            return JSON.stringify(responseBody);
        }
        catch (error) {
            console.error('❌ Error in Bedrock Multimodal API:', error);
            // Fallback to text-only
            return this.generateWithBedrockAPI(prompt);
        }
    }
    /**
     * Fallback method ใช้ Bedrock API โดยตรง (เหมือนเดิม)
     */
    async generateWithBedrockAPI(prompt, images) {
        // Extract model-level keyword arguments (legacy style, whitelist only allowed keys, use snake_case)
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
        // Claude 3.5/3.0: Use Bedrock Messages API
        const isClaude35 = this.modelId.startsWith('anthropic.claude-3-5-') || this.modelId.startsWith('anthropic.claude-3-sonnet-20240229');
        if (isClaude35) {
            // Messages API payload (Best Practice)
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
            // Claude 3.5/3.0: content is array of blocks, find first text block
            if (Array.isArray(responseBody.content)) {
                const textBlock = responseBody.content.find((c) => c.type === 'text' && typeof c.text === 'string');
                if (textBlock)
                    return textBlock.text;
            }
            if (responseBody.completion && typeof responseBody.completion === 'string')
                return responseBody.completion;
            return JSON.stringify(responseBody);
        }
        // Claude 2.x/รุ่นอื่น: ใช้ prompt string แบบเดิม
        let body = {};
        if (this.modelId.startsWith('anthropic.')) {
            // Claude (Anthropic) รุ่นเก่า
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
            // Titan
            body = {
                inputText: prompt,
                maxTokenCount: this.options.maxTokens ?? 4000,
                ...model_kwargs,
            };
        }
        else if (this.modelId.startsWith('meta.llama')) {
            // Llama
            body = {
                prompt,
                max_gen_len: this.options.maxTokens ?? 4000,
                ...model_kwargs,
            };
        }
        else {
            // Default (OpenAI, etc.)
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
    /**
     * Streaming generation using LangChain streaming
     * - ใช้ LangChain streaming แทนการ implement เอง
     * - เพิ่มการรองรับ multimodal
     */
    async *stream(prompt, images) {
        if (!this.langchainModel) {
            throw new Error('LangChain model not initialized');
        }
        try {
            // ตรวจสอบว่าต้องใช้ multimodal หรือไม่
            if (images && images.length > 0 && images.some(img => img.base64Data)) {
                console.log(`🤖 Using multimodal streaming with ${images.length} images`);
                yield* this.streamWithBedrockMultimodal(prompt, images);
                return;
            }
            const messages = [];
            // เพิ่ม system message ถ้ามี
            if (this.options.systemPrompt) {
                messages.push(new messages_1.SystemMessage(this.options.systemPrompt));
            }
            // เพิ่ม user message
            messages.push(new messages_1.HumanMessage(prompt));
            // ใช้ LangChain streaming
            const stream = await this.langchainModel.stream(messages);
            for await (const chunk of stream) {
                if (chunk.content) {
                    yield chunk.content;
                }
            }
        }
        catch (error) {
            // Fallback ไปใช้ Bedrock streaming API เดิม
            console.warn('LangChain streaming failed, falling back to direct Bedrock API:', error);
            yield* this.streamWithBedrockAPI(prompt, images);
        }
    }
    /**
     * Streaming สำหรับ multimodal
     */
    async *streamWithBedrockMultimodal(prompt, images) {
        try {
            const messages = this.buildMultimodalMessages(prompt, images);
            const inferenceConfig = {};
            if (this.options.maxTokens !== undefined)
                inferenceConfig.maxTokens = this.options.maxTokens;
            if (this.options.temperature !== undefined)
                inferenceConfig.temperature = this.options.temperature;
            if (this.options.topP !== undefined)
                inferenceConfig.topP = this.options.topP;
            const command = new client_bedrock_runtime_1.ConverseStreamCommand({
                modelId: this.modelId,
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
        catch (error) {
            console.error('❌ Error in Bedrock Multimodal streaming:', error);
            // Fallback to text-only streaming
            yield* this.streamWithBedrockAPI(prompt);
        }
    }
    /**
     * Fallback streaming method ใช้ Bedrock API โดยตรง (เหมือนเดิม)
     */
    async *streamWithBedrockAPI(prompt, images) {
        // ตัวอย่างนี้รองรับเฉพาะ message-based (Claude 3, Nova, Llama 3)
        // ถ้าต้องการรองรับ native payload (Cohere, Mistral) ต้อง implement เพิ่ม
        const modelId = this.modelId;
        // เตรียม message format ตาม Bedrock Messages API
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
        // สร้าง command
        const command = new client_bedrock_runtime_1.ConverseStreamCommand({
            modelId,
            messages,
            inferenceConfig,
        });
        // ส่ง request และอ่าน stream
        const response = await this.client.send(command);
        if (!response.stream) {
            return; // Early return if no stream is available
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
/**
 * getLLM: Return a Bedrock LLM instance for the requested modelId and options
 * - Compatible with backend-legacy/agents/llm_factory.py
 * - ใช้ LangChain เป็นหลัก แต่มี fallback ไปใช้ Bedrock API โดยตรง
 * - เพิ่มการรองรับ multimodal
 */
function getLLM(modelId, options = {}) {
    return new LLM(modelId, options);
}
//# sourceMappingURL=llmFactory.js.map