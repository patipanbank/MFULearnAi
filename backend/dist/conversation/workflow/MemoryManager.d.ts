import { ConversationMessage, MemoryState, MemorySettings, EmbeddingState } from '../types';
export declare class ConversationMemoryManager {
    private readonly REDIS_KEY_PREFIX;
    private readonly CHROMA_COLLECTION;
    private readonly SHORT_TERM_TTL;
    constructor();
    loadMemory(conversationId: string, settings: MemorySettings): Promise<MemoryState>;
    private loadShortTermMemory;
    private loadLongTermMemory;
    private buildContext;
    updateMemory(conversationId: string, messages: ConversationMessage[], settings: MemorySettings): Promise<void>;
    private updateShortTermMemory;
    private updateLongTermMemory;
    private createConversationSummary;
    private shouldCreateEmbedding;
    searchMemory(conversationId: string, query: string, limit?: number): Promise<EmbeddingState[]>;
    clearMemory(conversationId: string): Promise<void>;
    private clearLongTermMemory;
    getMemoryStats(conversationId: string): Promise<{
        shortTermCount: number;
        longTermCount: number;
        totalSize: number;
    }>;
    cleanup(): void;
}
//# sourceMappingURL=MemoryManager.d.ts.map