import { EmbeddingService, CreateEmbeddingDto, BatchEmbeddingDto } from './embedding.service';
export declare class EmbeddingController {
    private embeddingService;
    constructor(embeddingService: EmbeddingService);
    createEmbedding(body: CreateEmbeddingDto): Promise<any>;
    createBatchEmbeddings(body: BatchEmbeddingDto): Promise<any>;
    createImageEmbedding(body: {
        imageBase64: string;
        text?: string;
        modelId?: string;
    }): Promise<any>;
    querySimilarDocuments(body: {
        collectionName: string;
        queryText: string;
        nResults?: number;
        modelId?: string;
    }): Promise<any>;
    addDocumentsToCollection(body: {
        collectionName: string;
        documents: Array<{
            text: string;
            metadata?: any;
            id?: string;
        }>;
        modelId?: string;
    }): Promise<any>;
    compareEmbeddings(body: {
        embedding1: number[];
        embedding2: number[];
    }): Promise<any>;
    validateEmbedding(body: {
        embedding: number[];
    }): Promise<any>;
    getModelDimension(body: {
        modelId: string;
    }): Promise<any>;
}
