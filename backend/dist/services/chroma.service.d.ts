export interface ChromaDocument {
    id: string;
    text: string;
    embedding: number[];
    metadata?: Record<string, any>;
}
export declare class ChromaService {
    private readonly logger;
    private readonly client;
    constructor();
    private getCollection;
    addDocuments(collectionName: string, docs: ChromaDocument[]): Promise<void>;
    queryCollection(collectionName: string, embedding: number[], topK?: number): Promise<import("chromadb").QueryResult<import("chromadb").Metadata>>;
    getDocuments(collectionName: string, limit?: number, offset?: number): Promise<import("chromadb").GetResult<import("chromadb").Metadata>>;
    deleteDocuments(collectionName: string, ids: string[]): Promise<void>;
    countDocuments(collectionName: string): Promise<number>;
    deleteCollection(collectionName: string): Promise<void>;
}
