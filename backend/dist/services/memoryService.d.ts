export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}
export interface MemorySearchResult {
    content: string;
    role: string;
    timestamp: string;
    relevanceScore: number;
    metadata?: Record<string, any>;
}
export interface ConversationSummary {
    sessionId: string;
    summary: string;
    messageCount: number;
    lastUpdated: string;
    keyTopics: string[];
}
export declare class MemoryService {
    private bedrock;
    private readonly BUFFER_WINDOW_SIZE;
    private readonly TOKEN_LIMIT;
    private readonly SUMMARY_THRESHOLD;
    private readonly MIN_RELEVANCE_SCORE;
    constructor();
    addMessage(sessionId: string, message: ConversationMessage): Promise<void>;
    getConversationContext(sessionId: string, query?: string): Promise<ConversationMessage[]>;
    addRecentMessage(sessionId: string, message: any): Promise<void>;
    getRecentMessages(sessionId: string): Promise<any[]>;
    searchMemory(sessionId: string, query: string, k?: number): Promise<any[]>;
    private addToBuffer;
    private getBufferMessages;
    private getBufferSize;
    private clearBuffer;
    private performSummarization;
    private generateSummary;
    private extractKeyTopics;
    private updateSummary;
    private getConversationSummary;
    private addToVectorStore;
    private semanticSearch;
    private combineMessages;
    private trimToTokenLimit;
    embedMessage(sessionId: string, message: string): Promise<void>;
    getAllMessages(sessionId: string): Promise<any[]>;
    setupHybridMemory(sessionId: string, messages: any[]): Promise<void>;
    getMemoryStats(sessionId: string): Promise<any>;
    clearRecentMessages(sessionId: string): Promise<void>;
    clearLongTermMemory(sessionId: string): Promise<void>;
    clearAllMemory(sessionId: string): Promise<void>;
    forceSummarization(sessionId: string): Promise<ConversationSummary | null>;
    storeMemory(sessionId: string, key: string, value: string): Promise<void>;
    searchMemories(sessionId: string, query: string): Promise<Array<{
        key: string;
        value: string;
        timestamp: string;
    }>>;
    getAllMemories(sessionId: string): Promise<Array<{
        key: string;
        value: string;
        timestamp: string;
    }>>;
}
export declare const memoryService: MemoryService;
//# sourceMappingURL=memoryService.d.ts.map