"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bedrockService = exports.BedrockService = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
class BedrockService {
    constructor() {
        this.models = {
            claude35: "anthropic.claude-3-5-sonnet-20240620-v1:0",
            titanImage: "amazon.titan-image-generator-v1" // Updated to image generator model
        };
        this.defaultConfig = {
            temperature: 0.7,
            topP: 0.99,
            maxTokens: 2048
        };
        this.questionTypeConfigs = {
            factual: {
                temperature: 0.3, // Lower temperature for more focused, factual responses
                topP: 0.9,
                maxTokens: 1024,
                stopSequences: ["Human:", "Assistant:"]
            },
            analytical: {
                temperature: 0.7, // Balanced for analytical thinking
                topP: 0.95,
                maxTokens: 2048
            },
            conceptual: {
                temperature: 0.6, // Moderate temperature for clear explanations
                topP: 0.92,
                maxTokens: 2048
            },
            procedural: {
                temperature: 0.4, // Lower temperature for precise step-by-step instructions
                topP: 0.9,
                maxTokens: 2048
            },
            clarification: {
                temperature: 0.5, // Moderate temperature for clear clarifications
                topP: 0.9,
                maxTokens: 1024
            },
            visual: {
                temperature: 0.4,
                topP: 0.9,
                maxTokens: 2048
            },
            imageGeneration: {
                temperature: 0.8, // Higher temperature for more creative image descriptions
                topP: 0.95,
                maxTokens: 4096
            }
        };
        this.chatModel = this.models.claude35;
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    }
    async embedImage(imageBase64, text) {
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: this.models.titanImage,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    inputImage: imageBase64,
                    ...(text && { inputText: text })
                })
            });
            const response = await this.client.send(command);
            if (!response.body) {
                throw new Error("Empty response body");
            }
            const responseData = JSON.parse(new TextDecoder().decode(response.body));
            if (!responseData.embedding) {
                throw new Error("No embedding field in the response");
            }
            return responseData.embedding;
        }
        catch (error) {
            console.error("Error generating image embedding:", error);
            throw error;
        }
    }
    detectMessageType(messages) {
        const lastMessage = messages[messages.length - 1];
        const query = lastMessage.content.toLowerCase();
        const hasImage = lastMessage.images && lastMessage.images.length > 0;
        if (hasImage)
            return 'visual';
        if (/^(what|when|where|who|which|how many|how much)/i.test(query))
            return 'factual';
        if (/^(why|how|what if|analyze|compare|contrast)/i.test(query))
            return 'analytical';
        if (/^(explain|describe|define|what is|what are|how does)/i.test(query))
            return 'conceptual';
        if (/^(how to|how do|what steps|how can|show me how)/i.test(query))
            return 'procedural';
        if (/^(can you clarify|what do you mean|please explain|elaborate)/i.test(query))
            return 'clarification';
        return 'factual'; // Default
    }
    getModelConfig(messages) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.isImageGeneration) {
            return {
                ...this.defaultConfig,
                ...this.questionTypeConfigs.imageGeneration
            };
        }
        const messageType = this.detectMessageType(messages);
        return {
            ...this.defaultConfig,
            ...this.questionTypeConfigs[messageType]
        };
    }
    async generateImage(prompt) {
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: this.models.titanImage,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    taskType: "TEXT_IMAGE",
                    textToImageParams: {
                        text: prompt,
                        numberOfImages: 1,
                        imageHeight: 1024,
                        imageWidth: 1024,
                        cfgScale: 8.0,
                        seed: Math.floor(Math.random() * 1000000)
                    },
                    imageGenerationConfig: {
                        numberOfImages: 1,
                        quality: "standard",
                        height: 1024,
                        width: 1024,
                        cfgScale: 8.0
                    }
                })
            });
            const response = await this.client.send(command);
            if (!response.body) {
                throw new Error("Empty response body");
            }
            const responseData = JSON.parse(new TextDecoder().decode(response.body));
            if (!responseData.images || !responseData.images[0]) {
                throw new Error("No image generated");
            }
            return responseData.images[0];
        }
        catch (error) {
            console.error("Error generating image:", error);
            throw error;
        }
    }
    async *chat(messages, modelId) {
        try {
            const config = this.getModelConfig(messages);
            console.log('Using model config:', config);
            const lastMessage = messages[messages.length - 1];
            const isImageGeneration = lastMessage.isImageGeneration;
            if (isImageGeneration) {
                try {
                    const imageBase64 = await this.generateImage(lastMessage.content);
                    yield JSON.stringify({
                        type: 'generated-image',
                        data: imageBase64
                    });
                    return;
                }
                catch (error) {
                    console.error("Error in image generation:", error);
                    yield "I apologize, but I encountered an error while generating the image. Please try again or contact support if the issue persists.";
                    return;
                }
            }
            const command = new client_bedrock_runtime_1.InvokeModelWithResponseStreamCommand({
                modelId: this.models.claude35,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: config.maxTokens,
                    temperature: config.temperature,
                    top_p: config.topP,
                    stop_sequences: config.stopSequences,
                    messages: messages.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.images ? [
                            { type: 'text', text: msg.content },
                            ...msg.images.map(img => ({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: img.mediaType,
                                    data: img.data
                                }
                            }))
                        ] : msg.content
                    }))
                })
            });
            const response = await this.client.send(command);
            if (response.body) {
                for await (const chunk of response.body) {
                    if (chunk.chunk?.bytes) {
                        const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
                        try {
                            const parsedChunk = JSON.parse(decodedChunk);
                            if (parsedChunk.type === 'content_block_delta' &&
                                parsedChunk.delta?.type === 'text_delta' &&
                                parsedChunk.delta?.text) {
                                yield parsedChunk.delta.text;
                            }
                        }
                        catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Claude chat error:', error);
            throw error;
        }
    }
}
exports.BedrockService = BedrockService;
exports.bedrockService = new BedrockService();
