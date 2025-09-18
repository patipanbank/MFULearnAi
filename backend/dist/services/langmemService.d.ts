export interface LangMemConfig {
    maxMemories?: number;
    enableInserts?: boolean;
    enableUpdates?: boolean;
    enableDeletes?: boolean;
    namespace?: string[];
}
export interface MemoryEntry {
    id: string;
    content: string;
    type: 'conversation' | 'fact' | 'preference' | 'context';
    namespace: string;
    metadata: {
        sessionId: string;
        userId?: string;
        timestamp: string;
        relevance?: number;
        source?: string;
    };
}
export interface ConversationContext {
    sessionId: string;
    userId?: string;
    agentId?: string;
    namespace: string;
}
export declare class LangMemService {
    private memoryStore;
    private memoryManager;
    private storeManager;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    processMessages(messages: Array<{
        role: string;
        content: string;
        timestamp?: string;
    }>, context: ConversationContext, config?: LangMemConfig): Promise<MemoryEntry[]>;
    searchMemories(query: string, context: ConversationContext, options?: {
        limit?: number;
        type?: string;
        minRelevance?: number;
    }): Promise<MemoryEntry[]>;
    addMemory(content: string, context: ConversationContext, options?: {
        type?: string;
        metadata?: Record<string, any>;
    }): Promise<MemoryEntry>;
    getContextualMemories(context: ConversationContext, options?: {
        limit?: number;
        includeTypes?: string[];
    }): Promise<MemoryEntry[]>;
    clearMemories(context: ConversationContext): Promise<void>;
    getMemoryStats(context: ConversationContext): Promise<{
        totalMemories: number;
        typeBreakdown: Record<string, number>;
        oldestMemory?: string;
        newestMemory?: string;
        namespaceInfo: string;
    }>;
    private buildNamespace;
    private storeMemory;
    private getExistingMemories;
    private getAllMemoriesFromStore;
    private classifyMemoryType;
    private generateMemoryId;
    addRecentMessage(sessionId: string, message: any): Promise<void>;
    getRecentMessages(sessionId: string): Promise<any[]>;
    hasMemoryForSession(sessionId: string): Promise<boolean>;
    searchMemory(sessionId: string, query: string, k?: number): Promise<any[]>;
    embedMessage(sessionId: string, message: string): Promise<void>;
    clearRecentMessages(sessionId: string): Promise<void>;
    clearAllMemory(sessionId: string): Promise<void>;
    getAllMessages(sessionId: string): Promise<any[]>;
    clearLongTermMemory(sessionId: string): Promise<void>;
    getConversationContext(sessionId: string, query?: string): Promise<any[]>;
    addMessage(sessionId: string, message: any): Promise<void>;
}
export declare const langmemService: LangMemService;
//# sourceMappingURL=langmemService.d.ts.map