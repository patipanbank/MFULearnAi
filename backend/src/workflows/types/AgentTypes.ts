
export interface AgentContext {
    userId: string;
    sessionId: string;
    message: string;
    userRole: string;
    userDepartment: string;
    collectionId?: string;
    images: any[];
    files: any[];
    traceId?: string;
}

export interface WorkflowState {
    phase: AgentPhase;
    traceId: string;
    steps: number;
    totalUsage: { input: 0, output: 0, total: 0 };
    usedTools: Set<string>;
    answerMode: string;
    answerState: string;
    startTime: number;
    finalAnswer: string;
    history: any[];
    smartContext: any;
    nativeDocBlocks: NativeDocBlock[];
    extractedTextBlocks: ExtractedTextBlock[];
    uploadPromises: Promise<any>[];
    clientDisconnected: boolean;
    messages: any[];
    toolOutputs: any[];
    scratchpad: string[];
    tokenUsage: {
        input: number;
        output: number;
        total: number;
    };
}

export enum AgentPhase {
    INIT = 'INIT',
    UPLOADING = 'UPLOADING',
    OCR_WAIT = 'OCR_WAIT',
    PLANNING = 'PLANNING',
    EXECUTING_TOOL = 'EXECUTING_TOOL',
    GENERATING_RESPONSE = 'GENERATING_RESPONSE',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export interface AgentState {
    phase: AgentPhase;
    context: any; // Raw context
    smartContext: any; // Enriched context
    history: any[];
    messages: any[];
    toolOutputs: any[];
    finalAnswer?: string;
    nativeDocBlocks: NativeDocBlock[];
    extractedTextBlocks: ExtractedTextBlock[];
    uploadPromises: Promise<any>[];
    scratchpad: string[];
    tokenUsage: {
        input: number;
        output: number;
        total: number;
    };
    startTime: number;
}

export interface NativeDocBlock {
    type: 'document';
    format: string;
    name: string;
    data: string; // base64
}

export interface ExtractedTextBlock {
    fileName: string;
    text: string;
}

export interface FileJobResult {
    status: 'done' | 'failed' | 'pending';
    jobId: string;
    nativeDocBlocks: NativeDocBlock[];
    extractedTextBlocks: ExtractedTextBlock[];
    attachments: any[]; // Uploaded metadata
}

export const AGENT_EVENTS = {
    AGENT_START: 'agent_start',
    CONTEXT_LOADED: 'context_loaded',
    AGENT_STEP: 'agent_step',
    THINKING: 'thinking',
    TOOL_START: 'tool_start',
    TOOL_COMPLETE: 'tool_complete',
    ANSWER_START: 'answer_start',
    ANSWER_DELTA: 'answer_delta',
    ANSWER_DONE: 'answer_done',
    STEP_USAGE: 'step_usage',
    AGENT_COMPLETE: 'agent_complete',
    STATUS: 'status',
    METADATA: 'metadata',
    FILE_PROGRESS: 'file_progress',
    FILE_UPLOADED: 'file_uploaded',
    TITLE: 'title',
} as const;
