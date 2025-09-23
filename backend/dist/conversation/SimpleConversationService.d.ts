export interface SimpleConversationConfig {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    agentId?: string;
    collectionNames?: string[];
}
export interface ConversationRequest {
    conversationId: string;
    userId: string;
    message: string;
    config?: SimpleConversationConfig;
}
export interface ConversationResponse {
    messageId: string;
    content: string;
    role: 'assistant';
    status: 'completed' | 'failed';
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    processingTime: number;
    error?: string;
}
export declare class SimpleConversationService {
    private readonly MEMORY_KEY_PREFIX;
    private readonly MEMORY_TTL;
    private readonly MAX_HISTORY;
    constructor();
    processMessage(request: ConversationRequest, onChunk: (chunk: string) => void): Promise<ConversationResponse>;
    private getConversationHistory;
    private saveMessage;
    private buildPrompt;
    clearConversation(conversationId: string): Promise<void>;
    getConversationStats(conversationId: string): Promise<{
        messageCount: number;
        userMessages: number;
        assistantMessages: number;
        totalTokens: number;
        averageResponseTime: number;
    }>;
}
export declare const simpleConversationService: SimpleConversationService;
//# sourceMappingURL=SimpleConversationService.d.ts.map