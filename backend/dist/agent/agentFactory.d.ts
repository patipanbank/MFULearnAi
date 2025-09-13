import type { LLM } from './llmFactory';
export interface AgentExecutor {
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
}
export declare function createAgent(llm: LLM, customTools: {
    [name: string]: any;
} | undefined, prompt: string, config?: {
    modelId?: string;
    sessionId?: string;
    temperature?: number;
    maxTokens?: number;
}): Promise<AgentExecutor>;
export { agentFactory } from './core/AgentFactory';
export { toolRegistry } from './tools/ToolRegistry';
//# sourceMappingURL=agentFactory.d.ts.map