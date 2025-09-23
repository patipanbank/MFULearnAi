import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';
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
export declare function createAgent(llm: LLM, tools: {
    [name: string]: ToolFunction;
}, prompt: string, config?: {
    modelId?: string;
    sessionId?: string;
    temperature?: number;
    maxTokens?: number;
    collectionNames?: string[];
    userId?: string;
    agentId?: string;
    allowedTools?: string[];
}): Promise<AgentExecutor>;
//# sourceMappingURL=agentFactory.d.ts.map