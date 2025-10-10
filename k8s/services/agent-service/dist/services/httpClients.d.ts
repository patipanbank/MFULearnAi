/**
 * HTTP Clients for calling other microservices
 * Replaces direct service imports with HTTP calls
 */
export declare const ragClient: {
    searchMemory(sessionId: string, query: string, limit?: number): Promise<any>;
    embedMessage(sessionId: string, content: string): Promise<void>;
    searchCollection(collectionName: string, query: string, limit?: number): Promise<any>;
    embed(text: string): Promise<any>;
};
export declare const storageClient: {
    getDocument(documentId: string): Promise<any>;
};
export declare const bedrockClient: {
    invoke(params: any): Promise<{}>;
};
//# sourceMappingURL=httpClients.d.ts.map