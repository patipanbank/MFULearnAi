export declare class BedrockService {
    private client;
    constructor();
    createTextEmbedding(text: string): Promise<number[]>;
    createBatchTextEmbeddings(texts: string[]): Promise<number[][]>;
    createImageEmbedding(imageBase64: string, text?: string): Promise<number[]>;
    generateImage(prompt: string): Promise<string>;
    converseStream(modelId: string, messages: any[], systemPrompt: string, toolConfig?: any, temperature?: number, topP?: number): AsyncGenerator<any, void, unknown>;
}
export declare const bedrockService: BedrockService;
//# sourceMappingURL=bedrockService.d.ts.map