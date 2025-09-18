import { BaseMessage } from '@langchain/core/messages';
import { TemplateContext } from './promptTemplateManager';
import { TaskIntent, WorkflowComplexity } from './intentRouter';
export interface SimplifiedAgentConfig {
    modelId: string;
    systemPrompt?: string;
    sessionId: string;
    userId: string;
    agentId?: string;
    collectionNames?: string[];
    agentTools?: Array<{
        id: string;
        name: string;
        type: string;
        enabled: boolean;
        config?: any;
    }>;
    temperature?: number;
    maxTokens?: number;
    maxIterations?: number;
    intent?: TaskIntent;
    workflowComplexity?: WorkflowComplexity;
    useTemplateSystem?: boolean;
    templateContext?: TemplateContext;
}
export interface StreamingEvent {
    type: 'chunk' | 'tool_start' | 'tool_result' | 'end' | 'error';
    data: any;
}
export interface AgentExecutor {
    run: (messages: BaseMessage[], onEvent?: (event: StreamingEvent) => void) => Promise<string>;
    getState: () => any;
    visualize: () => string;
}
export declare class SimplifiedModernAgent {
    private llm;
    private tools;
    private config;
    private memoryContext?;
    private toolsInitialized;
    private static toolCache;
    constructor(config: SimplifiedAgentConfig);
    setupTools(): Promise<void>;
    private createToolCacheKey;
    private createMemoryToolsOptimized;
    private createDynamicTool;
    run(messages: BaseMessage[], onEvent?: (event: StreamingEvent) => void): Promise<string>;
    private retrieveMemoryContext;
    private buildSystemPrompt;
    private buildLegacyPrompt;
    private buildThinkingFormatInstructions;
    private buildMemoryContextInstructions;
    private buildToolInstructions;
    private streamLLMResponse;
    private extractToolCalls;
    private executeTools;
    private updateMemory;
    getState(): {
        sessionId: string;
        toolCount: number;
        modelId: string;
        hasMemoryContext: boolean;
    };
    visualize(): string;
}
export declare function createSimplifiedModernAgent(config: SimplifiedAgentConfig): Promise<AgentExecutor>;
//# sourceMappingURL=simplifiedModernAgent.d.ts.map