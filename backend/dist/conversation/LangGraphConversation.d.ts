export interface LangGraphConversationConfig {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    agentId?: string;
    enableTools?: boolean;
    tools?: string[];
}
export interface ConversationRequest {
    conversationId: string;
    userId: string;
    message: string;
    images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>;
    config?: LangGraphConversationConfig;
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
export declare class LangGraphConversationService {
    private workflow;
    private app;
    private readonly MEMORY_KEY_PREFIX;
    private readonly MEMORY_TTL;
    private readonly MAX_HISTORY;
    constructor();
    private setupWorkflow;
    private loadHistoryNode;
    private callModelNode;
    private saveMessageNode;
    processMessage(request: ConversationRequest, onChunk: (chunk: string) => void): Promise<ConversationResponse>;
    private buildPromptFromMessages;
    private getConversationHistory;
    private saveMessage;
    clearConversation(conversationId: string): Promise<void>;
}
export declare const langGraphConversationService: LangGraphConversationService;
//# sourceMappingURL=LangGraphConversation.d.ts.map