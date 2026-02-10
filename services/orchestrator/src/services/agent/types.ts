export enum Intent {
    // Core Capabilities
    FACT_LOOKUP = 'FACT_LOOKUP',
    CALCULATION = 'CALCULATION',
    RESEARCH = 'RESEARCH',
    CHITCHAT = 'CHITCHAT',

    // Domain Specific (Example)
    GRADE_CHECK = 'GRADE_CHECK',

    // Fallback
    AMBIGUOUS = 'AMBIGUOUS',
    GENERAL_QUERY = 'GENERAL_QUERY'
}

export type StepCondition = 'always' | 'if_previous_success' | 'if_variable_exists';

export interface WorkflowStep {
    id: string;
    tool: string;
    description: string;
    condition: StepCondition;
    requiredParams: string[]; // Keys that must be extracted
    stepTimeoutMs?: number;
}

export interface ExecutionPlan {
    policyId: string;
    version: string;
    intent: Intent;
    steps: WorkflowStep[];
    fallback?: WorkflowStep[];
}

export interface IntentAnalysisResult {
    intent: Intent;
    confidence: number;
    entities_raw: Record<string, any>;
    constraints_validated: Record<string, any>;
    reasoning?: string;
}

export interface ToolExecConfig {
    toolName: string;
    arguments: Record<string, any>;
    stepId: string;
}

export interface TraceStep {
    stepId: string;
    tool: string;
    input: any;
    output: any;
    status: 'SUCCESS' | 'FAILURE' | 'SKIPPED' | 'TIMEOUT';
    error?: string;
    durationMs: number;
    timestamp: string;
}

export interface ExecutionTrace {
    traceId: string;
    policyId: string;
    steps: TraceStep[];
    metadata?: any;
}
