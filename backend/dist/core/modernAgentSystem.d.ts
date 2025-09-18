import { BaseMessage } from '@langchain/core/messages';
export interface ModernAgentConfig {
    modelId: string;
    systemPrompt: string;
    sessionId: string;
    userId: string;
    agentId?: string;
    collectionNames?: string[];
    temperature?: number;
    maxTokens?: number;
    maxIterations?: number;
}
export interface AgentState {
    messages: BaseMessage[];
    iteration: number;
    finalAnswer?: string;
    toolResults: Record<string, any>;
    memoryContext?: any;
    currentTask?: string;
    sessionId: string;
    userId: string;
}
export interface StreamingEvent {
    type: 'chunk' | 'tool_start' | 'tool_result' | 'end' | 'error';
    data: any;
}
export declare class ModernAgentSystem {
    private llm;
    private tools;
    private graph;
    private config;
    private memory;
    constructor(config: ModernAgentConfig);
    private setupGraph;
    private memoryRetrievalNode;
    private reasoningNode;
    private toolExecutionNode;
    private memoryUpdateNode;
    private finalizeNode;
    private shouldUseTool;
    private detectToolCalls;
    private extractToolCalls;
    setupKnowledgeTools(): Promise<void>;
    setupMemoryTools(): Promise<void>;
    run(messages: BaseMessage[], onEvent?: (event: StreamingEvent) => void): Promise<string>;
    getState(): {
        sessionId: string;
        toolCount: number;
        modelId: string;
    };
    visualize(): string;
}
export declare function createModernAgent(config: ModernAgentConfig): Promise<{
    run: (messages: BaseMessage[], onEvent?: (event: StreamingEvent) => void) => Promise<string>;
    getState: () => {
        sessionId: string;
        toolCount: number;
        modelId: string;
    };
    visualize: () => string;
}>;
//# sourceMappingURL=modernAgentSystem.d.ts.map