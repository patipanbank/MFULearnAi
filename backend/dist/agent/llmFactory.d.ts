export interface LLMOptions {
    streaming?: boolean;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    model_kwargs?: Record<string, any>;
    [key: string]: any;
}
export declare class LLM {
    private client;
    private modelId;
    private options;
    constructor(modelId: string, options?: LLMOptions);
    generate(prompt: string): Promise<string>;
    stream(prompt: string): AsyncGenerator<string, void, unknown>;
}
export declare function getLLM(modelId: string, options?: LLMOptions): LLM;
//# sourceMappingURL=llmFactory.d.ts.map