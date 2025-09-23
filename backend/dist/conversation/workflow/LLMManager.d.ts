import { ConversationMessage, TokenUsage, MemoryState } from '../types';
interface LLMGenerationContext {
    messages: ConversationMessage[];
    currentMessage: ConversationMessage;
    memory: MemoryState;
    toolOutput?: any;
    config: any;
}
interface LLMResponse {
    content: string;
    tokenUsage?: TokenUsage;
    finishReason?: string;
}
export declare class ConversationLLMManager {
    private readonly DEFAULT_SYSTEM_PROMPT;
    constructor();
    generateResponse(context: LLMGenerationContext, onChunk: (chunk: string) => void): Promise<LLMResponse>;
    private preparePrompt;
    private buildConversationHistory;
    private mapMessageRoleToPromptRole;
    private formatToolResults;
    private formatSingleToolResult;
    validateAndEnhanceResponse(response: string, context: LLMGenerationContext): string;
    getModelCapabilities(modelId: string): {
        supportsVision: boolean;
        supportsStreaming: boolean;
        maxTokens: number;
        supportedTools: string[];
    };
    estimateTokenUsage(content: string): number;
    handleLLMError(error: any, context: LLMGenerationContext): string;
    cleanup(): void;
}
export {};
//# sourceMappingURL=LLMManager.d.ts.map