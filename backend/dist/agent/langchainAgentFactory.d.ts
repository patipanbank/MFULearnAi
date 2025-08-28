import { ToolFunction } from '../services/toolRegistry';
export interface LangChainAgentConfig {
    modelId: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    tools?: {
        [name: string]: ToolFunction;
    };
    sessionId?: string;
    collections?: string[];
}
export interface LangChainAgentExecutor {
    run: (messages: {
        role: string;
        content: string;
    }[], options?: {
        onEvent?: (event: {
            type: string;
            data?: any;
        }) => void;
        maxSteps?: number;
    }) => Promise<string>;
}
export declare function createLangChainAgent(config: LangChainAgentConfig): Promise<LangChainAgentExecutor>;
//# sourceMappingURL=langchainAgentFactory.d.ts.map