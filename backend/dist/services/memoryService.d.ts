export declare class MemoryService {
    addRecentMessage(sessionId: string, message: any): Promise<void>;
    getRecentMessages(sessionId: string): Promise<any[]>;
    clearRecentMessages(sessionId: string): Promise<void>;
    addLongTermMemory(sessionId: string, document: string, embedding: number[], metadata?: any): Promise<void>;
    searchLongTermMemory(sessionId: string, queryEmbedding: number[], k?: number): Promise<import("chromadb").QueryResult<import("chromadb").Metadata> | null>;
    clearLongTermMemory(sessionId: string): Promise<void>;
    embedMessage(sessionId: string, message: string): Promise<void>;
    searchMemory(sessionId: string, query: string, k?: number): Promise<any[]>;
    getAllMessages(sessionId: string): Promise<any[]>;
}
export declare const memoryService: MemoryService;
//# sourceMappingURL=memoryService.d.ts.map