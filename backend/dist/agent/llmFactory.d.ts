export interface LLMOptions {
    streaming?: boolean;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    model_kwargs?: Record<string, any>;
    systemPrompt?: string;
    [key: string]: any;
}
export declare class LLM {
    private client;
    private modelId;
    private options;
    private langchainModel;
    constructor(modelId: string, options?: LLMOptions);
    generate(prompt: string): Promise<string>;
    private generateWithBedrockAPI;
    stream(prompt: string): AsyncGenerator<string, void, unknown>;
    private streamWithBedrockAPI;
}
export declare function getLLM(modelId: string, options?: LLMOptions): LLM;
//# sourceMappingURL=llmFactory.d.ts.map