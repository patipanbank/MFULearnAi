import { TaskIntent, AgentType, WorkflowComplexity } from './intentRouter';
export declare enum TemplateType {
    SYSTEM_PROMPT = "system_prompt",
    REASONING_PROMPT = "reasoning_prompt",
    TOOL_GUIDANCE = "tool_guidance",
    INTENT_CLASSIFICATION = "intent_classification",
    AGENT_SPECIFIC = "agent_specific",
    WORKFLOW_STEP = "workflow_step",
    ERROR_HANDLING = "error_handling"
}
export declare enum TemplateCategory {
    AGENT = "agent",
    REASONING = "reasoning",
    INTENT = "intent",
    TOOL = "tool",
    ERROR = "error",
    WORKFLOW = "workflow"
}
export interface TemplateMetadata {
    id: string;
    name: string;
    description: string;
    type: TemplateType;
    category: TemplateCategory;
    version: string;
    agentTypes: AgentType[];
    intents: TaskIntent[];
    complexity: WorkflowComplexity[];
    variables: TemplateVariable[];
    tags: string[];
    author: string;
    createdAt: Date;
    updatedAt: Date;
    usage_count: number;
    effectiveness_score: number;
    isActive: boolean;
    isDefault: boolean;
}
export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    defaultValue?: any;
    validation?: {
        pattern?: string;
        min?: number;
        max?: number;
        enum?: any[];
    };
}
export interface TemplateContext {
    intent?: TaskIntent;
    agentType?: AgentType;
    complexity?: WorkflowComplexity;
    userMessage?: string;
    conversationHistory?: any[];
    tools?: string[];
    customAgent?: any;
    sessionData?: any;
    [key: string]: any;
}
export interface RenderedTemplate {
    content: string;
    metadata: TemplateMetadata;
    variables: Record<string, any>;
    renderTime: Date;
    version: string;
}
export declare class PromptTemplateManager {
    private static instance;
    private templates;
    private promptTemplates;
    private abTestGroups;
    private templateCache;
    private renderStats;
    private constructor();
    static getInstance(): PromptTemplateManager;
    registerTemplate(metadata: TemplateMetadata, templateContent: string): void;
    getTemplate(templateId: string, version?: string): TemplateMetadata | null;
    findTemplates(criteria: {
        type?: TemplateType;
        category?: TemplateCategory;
        agentType?: AgentType;
        intent?: TaskIntent;
        complexity?: WorkflowComplexity;
        tags?: string[];
    }): TemplateMetadata[];
    renderTemplate(templateId: string, context: TemplateContext): Promise<RenderedTemplate>;
    renderForIntentAndAgent(intent: TaskIntent, agentType: AgentType, context: TemplateContext): Promise<RenderedTemplate>;
    renderReasoningPrompt(complexity: WorkflowComplexity, context: TemplateContext): Promise<RenderedTemplate>;
    setupABTest(testName: string, templateIds: string[]): void;
    private selectTemplateForABTest;
    private prepareVariables;
    private validateAndConvertVariable;
    private updateTemplateStats;
    private renderDefaultTemplate;
    private renderDefaultReasoningTemplate;
    private getDefaultPromptForAgent;
    private hashString;
    private initializeDefaultTemplates;
    getStatistics(): any;
    clearCache(): void;
    updateEffectivenessScore(templateId: string, score: number): void;
}
export declare const promptTemplateManager: PromptTemplateManager;
//# sourceMappingURL=promptTemplateManager.d.ts.map