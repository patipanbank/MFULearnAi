import { BaseMessage } from '@langchain/core/messages';
import { TemplateContext } from './promptTemplateManager';
import { TaskIntent, WorkflowComplexity } from './intentRouter';
export interface ReasoningStep {
    step: number;
    thought: string;
    action?: string;
    observation?: string;
    confidence: number;
}
export interface ReasoningChain {
    problem: string;
    steps: ReasoningStep[];
    conclusion: string;
    totalConfidence: number;
    selectedPath: string;
}
export interface AdvancedAgentConfig {
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
    reasoningMode: 'cot' | 'zero-shot-cot' | 'auto-cot' | 'tree-of-thoughts';
    enableSelfConsistency?: boolean;
    enableReflection?: boolean;
    intent?: TaskIntent;
    workflowComplexity?: WorkflowComplexity;
    useTemplateSystem?: boolean;
    templateContext?: TemplateContext;
}
export interface StreamingEvent {
    type: 'chunk' | 'thinking' | 'reasoning_step' | 'tool_start' | 'tool_result' | 'reflection' | 'end' | 'error';
    data: any;
}
export interface AgentExecutor {
    run: (messages: BaseMessage[], onEvent?: (event: StreamingEvent) => void) => Promise<string>;
    getReasoningChain: () => ReasoningChain | null;
    getState: () => any;
    visualize: () => string;
}
export declare class AdvancedReasoningAgent {
    private llm;
    private tools;
    private config;
    private memoryContext?;
    private currentReasoningChain?;
    private reflectionHistory;
    private toolsInitialized;
    private static toolCache;
    constructor(config: AdvancedAgentConfig);
    setupTools(): Promise<void>;
    private setupAgentSpecificTools;
    private setupWebSearchTool;
    private setupCalculatorTool;
    private setupDateTool;
    private setupKnowledgeTools;
    private setupMemoryTools;
    private setupReasoningTools;
    run(messages: BaseMessage[], onEvent?: (event: StreamingEvent) => void): Promise<string>;
    private buildAdvancedReasoningPrompt;
    private buildLegacyPrompt;
    private buildReasoningModeInstructions;
    private buildMemoryContextInstructions;
    private buildToolGuidanceInstructions;
    private streamReasoningResponse;
    private extractProblemFromMessages;
    private extractReasoningSteps;
    private extractToolCallsWithReasoning;
    private reasonAboutToolUse;
    private reasonAboutMathProblem;
    private reasonAboutDateRequest;
    private reasonAboutKnowledgeSearch;
    private reasonAboutMemorySearch;
    private synthesizeSearchResults;
    private synthesizeMemoryContext;
    private performSelfReflection;
    private validateReasoningChain;
    private finalizeReasoningChain;
    private performFinalReflection;
    private executeToolsWithReasoning;
    private retrieveMemoryContext;
    private updateMemory;
    getReasoningChain(): ReasoningChain | null;
    getState(): {
        sessionId: string;
        toolCount: number;
        modelId: string;
        reasoningMode: "auto-cot" | "cot" | "tree-of-thoughts" | "zero-shot-cot";
        hasMemoryContext: boolean;
        currentReasoningSteps: number;
        reflectionCount: number;
    };
    visualize(): string;
}
export declare function createAdvancedReasoningAgent(config: AdvancedAgentConfig): Promise<AgentExecutor>;
//# sourceMappingURL=advancedReasoningAgent.d.ts.map