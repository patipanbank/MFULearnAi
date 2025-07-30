export declare class EmbeddingService {
    getTextEmbeddings(input: string[], model?: string): Promise<number[][]>;
    embed(text: string, model?: string): Promise<number[]>;
    embedBatch(texts: string[], model?: string): Promise<number[][]>;
}
export declare const embeddingService: EmbeddingService;
//# sourceMappingURL=embeddingService.d.ts.map