export declare class LangChainChatService {
    clearChatMemory(sessionId: string): Promise<void>;
    private shouldUseMemoryTool;
    private shouldUseRedisMemory;
    private shouldEmbedMessages;
    chat(sessionId: string, userId: string, message: string, modelId: string, collectionNames: string[], images?: any[], systemPrompt?: string, temperature?: number, maxTokens?: number): AsyncGenerator<string>;
}
export declare const langchainChatService: LangChainChatService;
//# sourceMappingURL=langchainChatService.d.ts.map