import { ChatMessage, SmartContext } from '../../../../shared/types';

// ── Inline Image in Bedrock format ──
export interface BedrockImage {
    format: string;
    source: { bytes: string };
    [key: string]: unknown;
}

// ── Raw file from multipart upload ──
export interface UploadedFile {
    name?: string;
    originalname?: string;
    mediaType?: string;
    size?: number;
    buffer?: Buffer;
    [key: string]: unknown;
}

// ── API Key access scope ──
export interface ApiKeyContext {
    isApiKey: boolean;
    allowedDepartments?: string[];
    allowedKnowledgeIds?: string[];
    allowedTools?: string[];
}

/**
 * Public request object for AgentWorkflow.execute().
 * Single-object parameter replaces the previous 11 positional args.
 */
export interface AgentExecuteRequest {
    userId: string;
    sessionId: string;
    message: string;
    userRole: string;
    userDepartment: string;
    collectionId?: string;
    modelId?: string;
    images?: BedrockImage[];
    files?: UploadedFile[];
    traceId?: string;
    apiKeyContext?: ApiKeyContext;
}

/** Internal context passed through the workflow pipeline. */
export interface AgentContext {
    userId: string;
    sessionId: string;
    message: string;
    userRole: string;
    userDepartment: string;
    collectionId?: string;
    /** Model ID used for this agent session (for cost weighting). */
    modelId?: string;
    /** Inline images in Bedrock format (format + source.bytes). */
    images: BedrockImage[];
    /** Raw file buffers from multipart upload. */
    files: UploadedFile[];
    traceId?: string;

    // ── API Key Context (Optional — only set when request is via API Key) ──
    /** Whether this request is from an API Key */
    isApiKey?: boolean;
    /** Departments the API Key is allowed to access. ['*'] = all. */
    allowedDepartments?: string[];
    /** Specific Knowledge IDs the API Key is allowed to access. */
    allowedKnowledgeIds?: string[];
    /** Tool names the API Key is allowed to use. ['*'] = all. Empty = none. */
    allowedTools?: string[];
}

/** Token usage counter */
export interface TokenUsage {
    input: number;
    output: number;
    total: number;
}

/** Possible answer modes for the agent response */
export type AnswerMode = 'internal' | 'rag' | 'file_grounded' | 'policy_grounded' | 'policy_rag';

/** Possible answer verification states */
export type AnswerState = 'UNVERIFIED' | 'VERIFIED' | 'TIMEOUT' | 'ERROR';

export interface WorkflowState {
    phase: AgentPhase;
    traceId: string;
    steps: number;
    totalUsage: TokenUsage;
    usedTools: Set<string>;
    answerMode: AnswerMode;
    answerState: AnswerState;
    startTime: number;
    finalAnswer: string;
    history: ChatMessage[];
    smartContext: SmartContext | null;
    nativeDocBlocks: NativeDocBlock[];
    extractedTextBlocks: ExtractedTextBlock[];
    uploadPromises: Promise<unknown>[];
    clientDisconnected: boolean;
    messages: BedrockMessage[];
    hasEmittedAnswerStart: boolean;
    /** In-session tool result cache — avoids redundant RAG/search calls within the same request */
    toolResultCache: Map<string, { result: unknown; timestamp: number }>;
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

/** Content block within a Bedrock Converse API message. */
export type BedrockContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; format: string; source: { bytes: string } }
    | { type: 'document'; format: string; name: string; source: { bytes: string } }
    | { type: 'tool_use'; toolUseId: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; toolUseId: string; content: unknown }
    | Record<string, unknown>;

/**
 * Message in Bedrock Converse API format.
 * Different from shared ChatMessage (which has content: string).
 */
export interface BedrockMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | BedrockContentBlock[];
}

/** Structured entry for tool execution results passed back to the LLM. */
export interface ToolResultEntry {
    toolUseId: string;
    content: Array<{ json: { result: unknown } }>;
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
    attachments: Array<{ s3Key?: string; fileType?: string;[key: string]: unknown }>;
}

export const AGENT_EVENTS = {
    AGENT_START: 'agent_start',
    CONTEXT_LOADED: 'context_loaded',
    AGENT_STEP: 'agent_step',
    TOOL_START: 'tool_start',
    TOOL_COMPLETE: 'tool_complete',
    BLOCK_START: 'block_start',
    BLOCK_DELTA: 'block_delta',
    BLOCK_END: 'block_end',
    STEP_USAGE: 'step_usage',
    AGENT_COMPLETE: 'agent_complete',
    STATUS: 'status',
    METADATA: 'metadata',
    FILE_PROGRESS: 'file_progress',
    FILE_UPLOADED: 'file_uploaded',
    TITLE: 'title',
    ERROR: 'error',
} as const;

/** Union type of all valid agent event names */
export type AgentEventType = typeof AGENT_EVENTS[keyof typeof AGENT_EVENTS];
