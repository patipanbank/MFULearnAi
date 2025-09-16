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
export declare class SmartMemoryService {
    private readonly RECENT_MESSAGE_LIMIT;
    private readonly MIN_RELEVANCE_SCORE;
    private readonly CONTEXT_TOKEN_LIMIT;
    addMessage(sessionId: string, message: ConversationMessage): Promise<void>;
    getConversationContext(sessionId: string, query?: string): Promise<ConversationMessage[]>;
    searchMemory(sessionId: string, query: string, limit?: number): Promise<MemorySearchResult[]>;
    private addToRecentCache;
    private getRecentMessages;
    private shouldEmbed;
    private embedMessage;
    private searchRelevantMessages;
    private mergeMessages;
    private trimToTokenLimit;
    clearSession(sessionId: string): Promise<void>;
    getMemoryStats(sessionId: string): Promise<{
        recentCount: number;
        embeddedCount: number;
        memoryType: string;
    }>;
}
export declare const smartMemoryService: SmartMemoryService;
//# sourceMappingURL=smartMemoryService.d.ts.map