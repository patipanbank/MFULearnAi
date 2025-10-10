/**
 * Chroma Service stub - Direct API calls to RAG service used in LangGraph
 */
export declare const chromaService: {
    searchCollection: (collectionName: string, query: string, nResults?: number) => Promise<{
        documents: any[];
        metadatas: any[];
    }>;
    embedText: (text: string) => Promise<any[]>;
    queryCollection: (collectionName: string, queryEmbeddings: any[], nResults?: number) => Promise<{
        documents: any[];
        metadatas: any[];
        distances: any[];
    }>;
    getDocuments: (collectionName: string) => Promise<{
        documents: any[];
        metadatas: any[];
        ids: any[];
    }>;
    addToCollection: (collectionName: string, documents: string[], metadatas: any[], ids: string[]) => Promise<void>;
};
//# sourceMappingURL=chromaService.d.ts.map