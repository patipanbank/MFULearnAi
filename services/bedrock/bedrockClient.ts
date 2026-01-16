import {
    BedrockRuntimeClient,
    InvokeModelWithResponseStreamCommand,
    InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../../shared/types';

interface ModelConfig {
    temperature: number;
    topP: number;
    maxTokens: number;
    stopSequences?: string[];
}

interface TokenUsage {
    input: number;
    output: number;
    total: number;
    estimatedCost: number;
}

// Cost per 1000 tokens (approximate)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'anthropic.claude-3-5-sonnet-20240620-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'amazon.titan-image-generator-v1': { input: 0, output: 0.012 } // per image
};

// Approved models for production
const APPROVED_PROD_MODELS = [
    'anthropic.claude-3-5-sonnet-20240620-v1:0',
    'anthropic.claude-3-haiku-20240307-v1:0'
];

export class BedrockService {
    private client: BedrockRuntimeClient;
    private envType: 'TEST' | 'PROD';

    public models = {
        claude35: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        claudeHaiku: "anthropic.claude-3-haiku-20240307-v1:0",
        claudeOpus: "anthropic.claude-3-opus-20240229-v1:0",
        claudeOpus: "anthropic.claude-3-opus-20240229-v1:0",
        titanImage: "amazon.titan-image-generator-v1",
        titanEmbed: "amazon.titan-embed-text-v1"
    };

    private readonly defaultConfig: ModelConfig = {
        temperature: 0.7,
        topP: 0.99,
        maxTokens: 4096
    };

    private lastTokenUsage: TokenUsage = { input: 0, output: 0, total: 0, estimatedCost: 0 };

    constructor() {
        this.envType = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';

        this.client = new BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'ap-southeast-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
            },
            // Timeout configuration
            requestHandler: {
                requestTimeout: 60000, // 60 second timeout
                httpsAgent: { timeout: 60000 }
            } as any
        });
    }

    /**
     * Validate and enforce model policy
     */
    private validateModel(modelId: string): string {
        if (this.envType === 'PROD') {
            if (!APPROVED_PROD_MODELS.includes(modelId)) {
                console.warn(`[Bedrock] Blocked non-approved model ${modelId} in PROD, using default`);
                return this.models.claude35;
            }
        }
        return modelId;
    }

    /**
     * Calculate estimated cost
     */
    private calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
        const costs = MODEL_COSTS[modelId] || MODEL_COSTS[this.models.claude35];
        return (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
    }

    /**
     * Retry wrapper with exponential backoff
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;

                // Don't retry for certain errors
                if (error.name === 'ValidationException' ||
                    error.name === 'AccessDeniedException' ||
                    error.$metadata?.httpStatusCode === 400) {
                    throw error;
                }

                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.log(`[Bedrock] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Generate image using Titan
     */
    async generateImage(prompt: string): Promise<string> {
        return this.withRetry(async () => {
            const command = new InvokeModelCommand({
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
            const responseData = JSON.parse(new TextDecoder().decode(response.body));

            if (!responseData.images || !responseData.images[0]) {
                throw new Error("No image generated");
            }

            return responseData.images[0];
        });
    }

    /**
     * Generate embedding for text using Titan
     */
    async generateEmbedding(text: string): Promise<number[]> {
        return this.withRetry(async () => {
            const command = new InvokeModelCommand({
                modelId: this.models.titanEmbed,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    inputText: text
                })
            });

            const response = await this.client.send(command);
            const responseData = JSON.parse(new TextDecoder().decode(response.body));

            if (!responseData.embedding) {
                throw new Error("No embedding generated");
            }

            return responseData.embedding;
        });
    }

    /**
     * Chat with streaming response
     */
    async *chat(
        messages: ChatMessage[],
        modelId: string = this.models.claude35
    ): AsyncGenerator<string> {
        const validatedModel = this.validateModel(modelId);

        // Convert messages to Claude format
        // Convert messages to Claude format
        const formattedMessages = messages
            .filter(msg => msg.role !== 'system')
            .map(msg => {
                const content: any[] = [];

                // Only add text block if there is actual text
                if (msg.content && msg.content.trim()) {
                    content.push({ type: 'text', text: msg.content });
                }

                if (msg.images) {
                    msg.images.forEach(img => {
                        content.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: img.mediaType,
                                data: img.data
                            }
                        });
                    });
                }

                // If message became empty (was only whitespace text), skip it
                if (content.length === 0) return null;

                return {
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content
                };
            })
            .filter(msg => msg !== null); // Remove nulls from map

        // Extract system message
        const systemMessage = messages.find(msg => msg.role === 'system');

        const payload = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: this.defaultConfig.maxTokens,
            temperature: this.defaultConfig.temperature,
            top_p: this.defaultConfig.topP,
            system: systemMessage?.content || '',
            messages: formattedMessages
        };

        const command = new InvokeModelWithResponseStreamCommand({
            modelId: validatedModel,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload)
        });

        try {
            const response = await this.withRetry(() => this.client.send(command));

            if (response.body) {
                let inputTokens = 0;
                let outputTokens = 0;

                for await (const chunk of response.body) {
                    if (chunk.chunk?.bytes) {
                        const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
                        try {
                            const parsedChunk = JSON.parse(decodedChunk);

                            // Track token usage
                            if (parsedChunk.type === 'message_start' && parsedChunk.message?.usage) {
                                inputTokens = parsedChunk.message.usage.input_tokens;
                            }

                            if (parsedChunk.type === 'message_delta' && parsedChunk.usage) {
                                outputTokens = parsedChunk.usage.output_tokens;
                            }

                            if (parsedChunk.type === 'message_stop' && parsedChunk['amazon-bedrock-invocationMetrics']) {
                                const metrics = parsedChunk['amazon-bedrock-invocationMetrics'];
                                inputTokens = metrics.inputTokenCount || inputTokens;
                                outputTokens = metrics.outputTokenCount || outputTokens;
                            }

                            // Yield text content
                            if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta?.text) {
                                yield parsedChunk.delta.text;
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }

                // Calculate and store usage
                const estimatedCost = this.calculateCost(validatedModel, inputTokens, outputTokens);
                this.lastTokenUsage = {
                    input: inputTokens,
                    output: outputTokens,
                    total: inputTokens + outputTokens,
                    estimatedCost
                };

                console.log(`[Bedrock] Token usage: ${this.lastTokenUsage.total} (est. cost: $${estimatedCost.toFixed(6)})`);
            }
        } catch (error: any) {
            console.error('[Bedrock] Chat error:', error);
            throw error;
        }
    }

    /**
     * Get last token usage
     */
    getLastTokenUsage(): TokenUsage {
        return this.lastTokenUsage;
    }

    /**
     * Check if a model is approved for production
     */
    isModelApproved(modelId: string): boolean {
        return APPROVED_PROD_MODELS.includes(modelId);
    }

    /**
     * Get available models for the environment
     */
    getAvailableModels(): string[] {
        if (this.envType === 'PROD') {
            return APPROVED_PROD_MODELS;
        }
        return Object.values(this.models).filter(m => m !== this.models.titanImage);
    }
}

export const bedrockService = new BedrockService();
