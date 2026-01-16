import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../../shared/types';

interface ModelConfig {
    temperature: number;
    topP: number;
    maxTokens: number;
    stopSequences?: string[];
}

export class BedrockService {
    private client: BedrockRuntimeClient;
    public models = {
        claude35: "anthropic.claude-3-5-sonnet-20240620-v1:0", // Production Approved
        titanImage: "amazon.titan-image-generator-v1"
    };

    private readonly defaultConfig: ModelConfig = {
        temperature: 0.7,
        topP: 0.99,
        maxTokens: 3000
    };

    private lastTokenUsage = { input: 0, output: 0, total: 0 };

    constructor() {
        this.client = new BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'ap-southeast-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
            }
        });
    }

    async generateImage(prompt: string): Promise<string> {
        try {
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
        } catch (error) {
            console.error("Error generating image:", error);
            throw error;
        }
    }

    async *chat(messages: ChatMessage[], modelId: string = this.models.claude35): AsyncGenerator<string> {
        try {
            // Create payload compatible with Claude 3.5 Sonnet
            const payload = {
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: this.defaultConfig.maxTokens,
                temperature: this.defaultConfig.temperature,
                top_p: this.defaultConfig.topP,
                messages: messages.map(msg => {
                    // Simplification: Not handling comprehensive multimodal logic yet, just text and image basics
                    const content: any[] = [{ type: 'text', text: msg.content }];

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

                    return {
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: content
                    };
                })
            };

            const command = new InvokeModelWithResponseStreamCommand({
                modelId: modelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload)
            });

            const response = await this.client.send(command);

            if (response.body) {
                let inputTokens = 0;
                let outputTokens = 0;

                for await (const chunk of response.body) {
                    if (chunk.chunk?.bytes) {
                        const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
                        try {
                            const parsedChunk = JSON.parse(decodedChunk);

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

                            if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta?.text) {
                                yield parsedChunk.delta.text;
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }

                this.lastTokenUsage = {
                    input: inputTokens,
                    output: outputTokens,
                    total: inputTokens + outputTokens
                };
                console.log('[Bedrock] Token usage:', this.lastTokenUsage);
            }
        } catch (error) {
            console.error('Bedrock chat error:', error);
            throw error;
        }
    }

    getLastTokenUsage() {
        return this.lastTokenUsage;
    }
}

export const bedrockService = new BedrockService();
