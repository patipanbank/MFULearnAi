import { BaseMessage } from '@langchain/core/messages';
export declare enum TaskIntent {
    KNOWLEDGE_SEARCH = "knowledge_search",
    ACADEMIC_QUESTION = "academic_question",
    RESEARCH_ASSISTANCE = "research_assistance",
    CODE_ASSISTANCE = "code_assistance",
    DEBUGGING_HELP = "debugging_help",
    TECHNICAL_EXPLANATION = "technical_explanation",
    WRITING_ASSISTANCE = "writing_assistance",
    CONTENT_CREATION = "content_creation",
    CREATIVE_BRAINSTORMING = "creative_brainstorming",
    DATA_ANALYSIS = "data_analysis",
    PROBLEM_SOLVING = "problem_solving",
    MATHEMATICAL_CALCULATION = "mathematical_calculation",
    TRANSLATION = "translation",
    LANGUAGE_LEARNING = "language_learning",
    COMMUNICATION_HELP = "communication_help",
    GENERAL_CONVERSATION = "general_conversation",
    CLARIFICATION_REQUEST = "clarification_request",
    FOLLOW_UP_QUESTION = "follow_up_question",
    SYSTEM_COMMAND = "system_command",
    AGENT_SELECTION = "agent_selection",
    UNKNOWN = "unknown"
}
export declare enum AgentType {
    ADVANCED_REASONING = "advanced_reasoning",
    SIMPLIFIED_MODERN = "simplified_modern",
    SPECIALIZED_KNOWLEDGE = "specialized_knowledge",
    CODE_ASSISTANT = "code_assistant",
    CREATIVE_WRITER = "creative_writer",
    RESEARCH_ANALYST = "research_analyst",
    GENERAL_ASSISTANT = "general_assistant"
}
export declare enum WorkflowComplexity {
    SIMPLE = "simple",
    MODERATE = "moderate",
    COMPLEX = "complex",
    COLLABORATIVE = "collaborative"
}
export interface IntentClassificationResult {
    primaryIntent: TaskIntent;
    confidence: number;
    secondaryIntents: TaskIntent[];
    reasoning: string;
    suggestedAgent: AgentType;
    workflowComplexity: WorkflowComplexity;
    requiredTools: string[];
    estimatedSteps: number;
    metadata: {
        hasContext: boolean;
        requiresReasoning: boolean;
        requiresKnowledge: boolean;
        requiresCalculation: boolean;
        requiresCreativity: boolean;
        isFollowUp: boolean;
    };
}
export interface RoutingDecision {
    selectedAgent: AgentType;
    agentConfig: any;
    workflowSteps: WorkflowStep[];
    toolRequirements: string[];
    reasoning: string;
    executionStrategy: ExecutionStrategy;
}
export interface WorkflowStep {
    stepId: string;
    stepType: 'analysis' | 'search' | 'reasoning' | 'generation' | 'verification';
    agentType: AgentType;
    requiredTools: string[];
    dependencies: string[];
    estimatedDuration: number;
    description: string;
}
export declare enum ExecutionStrategy {
    DIRECT = "direct",
    SEQUENTIAL = "sequential",
    PARALLEL = "parallel",
    ADAPTIVE = "adaptive"
}
export declare class IntentRouter {
    private llm;
    private conversationHistory;
    constructor();
    classifyIntent(input: string, sessionId: string, previousMessages?: BaseMessage[]): Promise<IntentClassificationResult>;
    routeToAgent(classification: IntentClassificationResult): Promise<RoutingDecision>;
    executeConditionalFlow(decision: RoutingDecision, input: string, context: any): Promise<WorkflowStep[]>;
    private buildClassificationPrompt;
    private parseClassificationResponse;
    private getFallbackClassification;
    private selectOptimalAgent;
    private generateWorkflowSteps;
    private determineExecutionStrategy;
    private buildAgentConfig;
    private getTemperatureForIntent;
    private updateConversationHistory;
    private executeWorkflowStep;
    private groupParallelSteps;
    private executeAdaptiveWorkflow;
    cleanupSession(sessionId: string): void;
    getStatistics(): any;
}
export declare const intentRouter: IntentRouter;
//# sourceMappingURL=intentRouter.d.ts.map