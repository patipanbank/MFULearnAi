export interface BedrockMessage {
    role: 'user' | 'assistant';
    content: {
        text: string;
    }[];
}
export interface ConverseStreamRequest {
    messages: BedrockMessage[];
    system_prompt?: string;
    model_id?: string;
    tool_config?: any;
    temperature?: number;
    top_p?: number;
}
export interface ImageGenerationRequest {
    prompt: string;
    width?: number;
    height?: number;
    quality?: string;
}
export interface ImageGenerationResponse {
    image: string;
}
export declare class BedrockService {
    private bedrockRuntimeClient;
    private bedrockClient;
    private defaultModelId;
    constructor();
    createTextEmbedding(text: string, modelId?: string): Promise<number[]>;
    createBatchTextEmbeddings(texts: string[], modelId?: string): Promise<number[][]>;
    createImageEmbedding(imageBase64: string, text?: string, modelId?: string): Promise<number[]>;
    generateImage(prompt: string, width?: number, height?: number, quality?: string): Promise<string>;
    converseStream(modelId: string, messages: BedrockMessage[], systemPrompt?: string, toolConfig?: any, temperature?: number, topP?: number): AsyncGenerator<any, void, unknown>;
    healthCheck(): Promise<any>;
    listModels(): Promise<string[]>;
}
export declare const bedrockService: BedrockService;
//# sourceMappingURL=bedrockService.d.ts.map