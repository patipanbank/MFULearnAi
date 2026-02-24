/**
 * OpenAI-Compatible API Types
 * Follows the OpenAI API specification for maximum compatibility with
 * existing SDKs (openai Python/JS, LangChain, Cursor, Continue, etc.)
 */

// ── Request Types ────────────────────────────────────────

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | OpenAIContentPart[] | null;
    name?: string;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
}

export interface OpenAIContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, any>;
    };
}

export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ChatCompletionRequest {
    model: string;
    messages: OpenAIMessage[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    stop?: string | string[];
    frequency_penalty?: number;
    presence_penalty?: number;
    n?: number;
    response_format?: { type: 'text' | 'json_object' };
    tools?: OpenAITool[];
    tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
    user?: string;
}

export interface EmbeddingRequest {
    model: string;
    input: string | string[];
    encoding_format?: 'float' | 'base64';
    user?: string;
}

// ── Response Types ───────────────────────────────────────

export interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage: OpenAIUsage;
    system_fingerprint?: string;
}

export interface ChatCompletionChoice {
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
    logprobs?: null;
}

export interface ChatCompletionChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: ChatCompletionChunkChoice[];
    usage?: OpenAIUsage | null;
    system_fingerprint?: string;
}

export interface ChatCompletionChunkChoice {
    index: number;
    delta: Partial<OpenAIMessage>;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
    logprobs?: null;
}

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface EmbeddingResponse {
    object: 'list';
    data: EmbeddingData[];
    model: string;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}

export interface EmbeddingData {
    object: 'embedding';
    index: number;
    embedding: number[];
}

export interface ModelObject {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
    permission?: any[];
}

export interface ModelListResponse {
    object: 'list';
    data: ModelObject[];
}

export interface OpenAIError {
    error: {
        message: string;
        type: string;
        param?: string | null;
        code?: string | null;
    };
}
