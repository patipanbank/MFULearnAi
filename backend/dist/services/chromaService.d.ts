import { Collection } from 'chromadb';
export declare class ChromaService {
    private client;
    private embeddingFunction;
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
    }>, onProgress?: (completed: number, total: number) => void): Promise<void>;
    private addDocumentsInBatches;
    queryCollection(collectionName: string, queryEmbeddings: number[][], nResults?: number): Promise<import("chromadb").QueryResult<import("chromadb").Metadata> | {
        documents: never[];
        metadatas: never[];
        distances: never[];
    }>;
    getDocuments(collectionName: string, limit?: number, offset?: number): Promise<{
        documents: {
            id: string;
            document: string | null;
            metadata: import("chromadb").Metadata | null;
        }[];
        total: number;
    }>;
    deleteDocuments(collectionName: string, documentIds: string[]): Promise<void>;
    documentExists(collectionName: string, id: string): Promise<boolean>;
    deleteDocumentsBySource(collectionName: string, sourceName: string): Promise<void>;
    getAllFromCollection(collectionName: string): Promise<Array<{
        document: string | null;
        metadata: any;
    }>>;
    getVectorStore(collectionName: string): null;
}
export declare const chromaService: ChromaService;
//# sourceMappingURL=chromaService.d.ts.map