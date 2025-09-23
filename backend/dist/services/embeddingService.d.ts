export declare class EmbeddingService {
    getTextEmbeddings(input: string[], model?: string): Promise<number[][]>;
    embed(text: string, model?: string): Promise<number[]>;
    embedBatch(texts: string[], model?: string): Promise<number[][]>;
    healthCheck(): Promise<boolean>;
}
export declare const embeddingService: EmbeddingService;
//# sourceMappingURL=embeddingService.d.ts.map