import { Collection } from 'chromadb';
export declare class ChromaService {
    private client;
    constructor();
    getOrCreateCollection(name: string): Promise<Collection>;
    listCollections(): Promise<Collection[]>;
    deleteCollection(collectionName: string): Promise<void>;
    addToCollection(collectionName: string, documents: string[], embeddings: number[][], metadatas: any[], ids: string[]): Promise<void>;
    addDocuments(collectionName: string, documentsWithEmbeddings: Array<{
        document: string;
        embedding: number[];
        metadata: any;
        id: string;
    }>): Promise<void>;
    queryCollection(collectionName: string, queryEmbeddings: number[][], nResults?: number): Promise<import("chromadb").QueryResult<import("chromadb").Metadata> | null>;
    getDocuments(collectionName: string, limit?: number, offset?: number): Promise<{
        documents: {
            id: string;
            document: string | null;
            metadata: import("chromadb").Metadata | null;
        }[];
        total: number;
    }>;
    deleteDocuments(collectionName: string, documentIds: string[]): Promise<void>;
    deleteDocumentsBySource(collectionName: string, sourceName: string): Promise<void>;
    getAllFromCollection(collectionName: string): Promise<Array<{
        document: string | null;
        metadata: any;
    }>>;
    getVectorStore(collectionName: string): null;
}
export declare const chromaService: ChromaService;
//# sourceMappingURL=chromaService.d.ts.map