import { BaseMessage } from '@langchain/core/messages';
export interface AgentState {
    messages: BaseMessage[];
    sessionId?: string;
    userId?: string;
    agentId?: string;
    collectionNames: string[];
    memoryContext?: any;
    toolResults: Record<string, any>;
    iterations: number;
    maxIterations: number;
    finalAnswer?: string;
    reasoning: string[];
    sources: string[];
    confidence: number;
}
export interface LangGraphAgentConfig {
    modelId: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    sessionId?: string;
    userId?: string;
    agentId?: string;
    collectionNames?: string[];
    allowedTools?: string[];
    maxIterations?: number;
}
export interface LangGraphAgentExecutor {
    run: (messages: {
        role: string;
        content: string;
    }[], options?: {
        onEvent?: (event: {
            type: string;
            data?: any;
        }) => void;
        maxSteps?: number;
        images?: Array<{
            url: string;
            mediaType: string;
            base64Data?: string;
        }>;
    }) => Promise<string>;
    getState: () => AgentState | null;
    visualize: () => string;
}
export declare function createLangGraphAgent(config: LangGraphAgentConfig): Promise<LangGraphAgentExecutor>;
//# sourceMappingURL=langgraphAgentFactory.d.ts.map