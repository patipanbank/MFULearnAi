/**
 * Memory Service stub - LangGraph now handles memory with StateGraph checkpointer
 */
export declare const memoryService: {
    getConversationContext: (sessionId: string, query: string) => Promise<{}>;
    searchMemory: (sessionId: string, query: string, limit: number) => Promise<any[]>;
    addMessage: (sessionId: string, message: any) => Promise<void>;
    embedMessage: (sessionId: string, content: string) => Promise<void>;
};
//# sourceMappingURL=memoryService.d.ts.map