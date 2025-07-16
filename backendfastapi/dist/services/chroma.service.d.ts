import { ConfigService } from '../config/config.service';
export interface ChromaDocument {
    id: string;
    document: string;
    metadata?: any;
    embedding?: number[];
}
export interface ChromaQueryResult {
    ids: string[][];
    distances: number[][] | null;
    metadatas: any[][];
    documents: string[][];
}
export declare class ChromaService {
    private configService;
    private readonly logger;
    private client;
    constructor(configService: ConfigService);
    private initializeChromaClient;
    private getCollection;
    listCollections(): Promise<any[]>;
    deleteCollection(collectionName: string): Promise<void>;
    queryCollection(collectionName: string, queryEmbeddings: number[][], nResults?: number): Promise<ChromaQueryResult | null>;
    addToCollection(collectionName: string, documents: string[], embeddings: number[][], metadatas: any[], ids: string[]): Promise<void>;
    addDocuments(collectionName: string, documentsWithEmbeddings: ChromaDocument[]): Promise<void>;
    getDocuments(collectionName: string, limit?: number, offset?: number): Promise<{
        documents: ChromaDocument[];
        total: number;
    }>;
    deleteDocuments(collectionName: string, documentIds: string[]): Promise<void>;
    deleteDocumentsBySource(collectionName: string, sourceName: string): Promise<void>;
    updateCollection(collectionName: string, ids: string[], embeddings?: number[][], documents?: string[], metadatas?: any[]): Promise<void>;
    upsertCollection(collectionName: string, ids: string[], embeddings?: number[][], documents?: string[], metadatas?: any[]): Promise<void>;
}
