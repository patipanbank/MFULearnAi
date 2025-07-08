export declare class BedrockService {
    private readonly client;
    private readonly logger;
    constructor();
    createTextEmbedding(text: string): Promise<number[]>;
    createBatchTextEmbeddings(texts: string[]): Promise<number[][]>;
    generateImage(prompt: string): Promise<string>;
    converseStream({ modelId, messages, systemPrompt, toolConfig, temperature, topP, maxTokens, }: {
        modelId?: string;
        messages: any[];
        systemPrompt?: string;
        toolConfig?: Record<string, any>;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }): Promise<AsyncGenerator<any, void, unknown>>;
    embed(text: string): Promise<number[]>;
}
