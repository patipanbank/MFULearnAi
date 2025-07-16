import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService } from '../services/chroma.service';
export interface CreateEmbeddingDto {
    text: string;
    modelId?: string;
}
export interface BatchEmbeddingDto {
    texts: string[];
    modelId?: string;
}
export declare class EmbeddingService {
    private bedrockService;
    private chromaService;
    private readonly logger;
    constructor(bedrockService: BedrockService, chromaService: ChromaService);
    createEmbedding(text: string, modelId?: string): Promise<number[]>;
    createBatchEmbeddings(texts: string[], modelId?: string): Promise<number[][]>;
    createImageEmbedding(imageBase64: string, text?: string, modelId?: string): Promise<number[]>;
    querySimilarDocuments(collectionName: string, queryText: string, nResults?: number, modelId?: string): Promise<any>;
    addDocumentsToCollection(collectionName: string, documents: Array<{
        text: string;
        metadata?: any;
        id?: string;
    }>, modelId?: string): Promise<void>;
    getModelDimension(modelId: string): Promise<number>;
    validateEmbedding(embedding: number[]): Promise<boolean>;
    compareEmbeddings(embedding1: number[], embedding2: number[]): Promise<number>;
}
