import { ConfigService } from '../config/config.service';
export interface BedrockMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface BedrockSystemMessage {
    text: string;
}
export interface BedrockInferenceConfig {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
}
export interface BedrockToolConfig {
    tools?: any[];
}
export declare class BedrockService {
    private configService;
    private readonly logger;
    private bedrockClient;
    private bedrockAgentClient;
    constructor(configService: ConfigService);
    private initializeBedrockClients;
    createTextEmbedding(text: string): Promise<number[]>;
    createBatchTextEmbeddings(texts: string[]): Promise<number[][]>;
    createImageEmbedding(imageBase64: string, text?: string): Promise<number[]>;
    generateImage(prompt: string): Promise<string>;
    converseStream(modelId: string, messages: BedrockMessage[], systemPrompt: string, toolConfig?: BedrockToolConfig, temperature?: number, topP?: number): AsyncGenerator<any, void, unknown>;
    invokeAgent(agentId: string, agentAliasId: string, sessionId: string, input: {
        text: string;
    }): Promise<any>;
    getModelDimension(modelId: string): number;
    generateEmbedding(text: string, modelId?: string): Promise<number[]>;
    generateBatchEmbeddings(texts: string[], modelId?: string): Promise<number[][]>;
}
