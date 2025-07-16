import { ConfigService } from '../config/config.service';
import { BedrockService } from '../bedrock/bedrock.service';
export interface ChromaDocument {
    id: string;
    document: string;
    metadata: Record<string, any>;
    embedding: number[];
}
export interface ChromaQueryResult {
    ids: string[];
    documents: string[];
    metadatas: Record<string, any>[];
    distances: number[];
}
export interface ChromaCollection {
    name: string;
    metadata?: Record<string, any>;
}
export declare class ChromaService {
    private configService;
    private bedrockService;
    private readonly logger;
    private client;
    private defaultEmbeddingFunction;
    constructor(configService: ConfigService, bedrockService: BedrockService);
    private initializeChromaClient;
    private getCollection;
    listCollections(): Promise<ChromaCollection[]>;
    deleteCollection(collectionName: string): Promise<void>;
    queryCollection(collectionName: string, queryEmbeddings: number[], nResults?: number): Promise<ChromaQueryResult | null>;
    addDocuments(collectionName: string, documentsWithEmbeddings: ChromaDocument[]): Promise<void>;
    getDocuments(collectionName: string, limit?: number, offset?: number): Promise<{
        documents: any[];
        total: number;
    }>;
    deleteDocuments(collectionName: string, documentIds: string[]): Promise<void>;
    deleteDocumentsBySource(collectionName: string, sourceName: string): Promise<void>;
    getVectorStore(collectionName: string): any;
}
