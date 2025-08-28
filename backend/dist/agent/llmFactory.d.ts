export interface ImageBlock {
    type: 'image';
    source: {
        type: 'base64';
        media_type: string;
        data: string;
    };
}
export interface TextBlock {
    type: 'text';
    text: string;
}
export type ContentBlock = TextBlock | ImageBlock;
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
    private buildMultimodalMessages;
    generate(prompt: string, images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>): Promise<string>;
    private generateWithBedrockMultimodal;
    private generateWithBedrockAPI;
    stream(prompt: string, images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>): AsyncGenerator<string, void, unknown>;
    private streamWithBedrockMultimodal;
    private streamWithBedrockAPI;
}
export declare function getLLM(modelId: string, options?: LLMOptions): LLM;
//# sourceMappingURL=llmFactory.d.ts.map