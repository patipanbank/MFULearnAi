export interface EmbeddingOptions {
    model?: string;
    dimensions?: number;
    maxRetries?: number;
}
export declare class RealEmbeddingService {
    private client;
    private cache;
    private options;
    constructor(options?: EmbeddingOptions);
    embed(text: string, options?: Partial<EmbeddingOptions>): Promise<number[]>;
    embedBatch(texts: string[], options?: Partial<EmbeddingOptions>): Promise<number[][]>;
    private generateEmbedding;
    private getExpectedDimensions;
    private getCacheKey;
    calculateSimilarity(embedding1: number[], embedding2: number[]): number;
    findMostSimilar(queryEmbedding: number[], candidateEmbeddings: number[][], topK?: number): Array<{
        index: number;
        similarity: number;
    }>;
    clearCache(): void;
    getCacheStats(): {
        size: number;
        keys: string[];
    };
    healthCheck(): Promise<boolean>;
}
export declare const realEmbeddingService: RealEmbeddingService;
//# sourceMappingURL=realEmbeddingService.d.ts.map