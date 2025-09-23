import { EventEmitter } from 'events';
export interface AgenticTask {
    id: string;
    type: 'simple' | 'complex' | 'research' | 'creative' | 'analytical';
    intent: UserIntent;
    context: TaskContext;
    priority: TaskPriority;
    constraints: TaskConstraints;
    expectedOutputs: ExpectedOutput[];
}
export interface UserIntent {
    primary: string;
    secondary?: string[];
    domain: 'general' | 'academic' | 'technical' | 'creative' | 'research';
    complexity: 'low' | 'medium' | 'high' | 'expert';
    urgency: 'low' | 'normal' | 'high' | 'critical';
}
export interface TaskContext {
    sessionId: string;
    userId: string;
    agentId?: string;
    previousMessages: any[];
    availableTools: string[];
    collectionNames: string[];
    userPreferences: Record<string, any>;
    conversationHistory: any[];
}
export interface TaskConstraints {
    maxExecutionTime?: number;
    maxTokens?: number;
    requiredTools?: string[];
    prohibitedTools?: string[];
    outputFormat?: 'text' | 'markdown' | 'json' | 'structured';
    quality: 'fast' | 'balanced' | 'comprehensive';
}
export interface ExpectedOutput {
    type: 'answer' | 'analysis' | 'summary' | 'recommendation' | 'data';
    format: string;
    confidence: number;
}
export declare enum TaskPriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
}
export interface ExecutionPlan {
    id: string;
    taskId: string;
    steps: ExecutionStep[];
    dependencies: StepDependency[];
    estimatedDuration: number;
    resourceRequirements: ResourceRequirement[];
    fallbackStrategies: FallbackStrategy[];
}
export interface ExecutionStep {
    id: string;
    type: 'analysis' | 'retrieval' | 'generation' | 'tool_execution' | 'validation';
    operation: string;
    inputs: Record<string, any>;
    expectedOutputs: Record<string, any>;
    tools: string[];
    parallel: boolean;
    optional: boolean;
    timeout: number;
}
export interface StepDependency {
    stepId: string;
    dependsOn: string[];
    condition?: string;
}
export interface ResourceRequirement {
    type: 'memory' | 'cpu' | 'network' | 'storage';
    amount: number;
    priority: 'required' | 'preferred' | 'optional';
}
export interface FallbackStrategy {
    condition: string;
    alternativeSteps: ExecutionStep[];
    degradedQuality: boolean;
}
export interface AgenticResponse {
    id: string;
    taskId: string;
    success: boolean;
    content: string;
    metadata: ResponseMetadata;
    toolExecutions: ToolExecutionSummary[];
    performance: PerformanceMetrics;
    recommendations?: string[];
}
export interface ResponseMetadata {
    confidence: number;
    completeness: number;
    accuracy: number;
    relevance: number;
    sources: string[];
    reasoning: string[];
    limitations: string[];
}
export interface ToolExecutionSummary {
    toolName: string;
    duration: number;
    success: boolean;
    inputSize: number;
    outputSize: number;
    relevanceScore: number;
}
export interface PerformanceMetrics {
    totalDuration: number;
    planningTime: number;
    executionTime: number;
    validationTime: number;
    tokensUsed: number;
    toolsExecuted: number;
    memoryAccessed: number;
}
export declare class AgentOrchestrationService extends EventEmitter {
    private static instance;
    private activeTasks;
    private executionPlans;
    private activeExecutions;
    private performanceHistory;
    private constructor();
    static getInstance(): AgentOrchestrationService;
    processAgenticTask(userInput: string, context: TaskContext, constraints?: Partial<TaskConstraints>): Promise<AgenticResponse>;
    private analyzeUserIntent;
    private createExecutionPlan;
    private executeAdaptivePlan;
    private executeStep;
    private executeRetrievalStep;
    private executeGenerationStep;
    private executeToolStep;
    private executeValidationStep;
    private executeAnalysisStep;
    private setupEventHandlers;
    private determineComplexity;
    private determineDomain;
    private determineTaskType;
    private extractPrimaryIntent;
    private extractSecondaryIntents;
    private determineUrgency;
    private mapUrgencyToPriority;
    private determineExpectedOutputs;
    private shouldIncludeWebSearch;
    private estimatePlanDuration;
    private calculateResourceRequirements;
    private createFallbackStrategies;
    private calculateDependencyLevels;
    private collectContextData;
    private buildPromptFromContext;
    private enhanceResponse;
    private summarizeToolExecutions;
    private generateRecommendations;
    private calculatePerformanceMetrics;
    private calculateConfidence;
    private calculateCompleteness;
    private calculateRelevance;
    private extractSources;
    private extractReasoning;
    private identifyLimitations;
    private emitTaskCompletion;
    getActiveTasksCount(): number;
    getPerformanceHistory(): PerformanceMetrics[];
    getAverageExecutionTime(): number;
}
export declare const agentOrchestrationService: AgentOrchestrationService;
//# sourceMappingURL=agentOrchestrationService.d.ts.map