import { HttpException, HttpStatus } from '@nestjs/common';
export declare abstract class AppException extends HttpException {
    readonly context?: Record<string, any> | undefined;
    readonly errorCause?: Error | undefined;
    abstract readonly code: string;
    abstract readonly userMessage: string;
    constructor(message: string, status: HttpStatus, context?: Record<string, any> | undefined, errorCause?: Error | undefined);
    toJSON(): {
        name: string;
        code: string;
        message: string;
        userMessage: string;
        status: number;
        context: Record<string, any> | undefined;
        timestamp: string;
        cause: string | undefined;
    };
}
export declare class AuthenticationException extends AppException {
    readonly code = "AUTH_001";
    readonly userMessage = "Authentication failed. Please check your credentials.";
    constructor(message?: string, context?: Record<string, any>, cause?: Error);
}
export declare class AuthorizationException extends AppException {
    readonly code = "AUTH_002";
    readonly userMessage = "You do not have permission to access this resource.";
    constructor(message?: string, context?: Record<string, any>, cause?: Error);
}
export declare class TokenExpiredException extends AppException {
    readonly code = "AUTH_003";
    readonly userMessage = "Your session has expired. Please log in again.";
    constructor(message?: string, context?: Record<string, any>, cause?: Error);
}
export declare class AgentNotFoundException extends AppException {
    readonly code = "AGENT_001";
    readonly userMessage = "The requested agent was not found.";
    constructor(agentId: string, context?: Record<string, any>, cause?: Error);
}
export declare class AgentExecutionException extends AppException {
    readonly code = "AGENT_002";
    readonly userMessage = "Agent execution failed. Please try again.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class ToolExecutionException extends AppException {
    readonly code = "TOOL_001";
    readonly userMessage = "Tool execution failed. Please try again.";
    constructor(toolName: string, message: string, context?: Record<string, any>, cause?: Error);
}
export declare class ChatNotFoundException extends AppException {
    readonly code = "CHAT_001";
    readonly userMessage = "The requested chat was not found.";
    constructor(chatId: string, context?: Record<string, any>, cause?: Error);
}
export declare class MessageTooLongException extends AppException {
    readonly code = "CHAT_002";
    readonly userMessage = "Your message is too long. Please shorten it and try again.";
    constructor(length: number, maxLength: number, context?: Record<string, any>, cause?: Error);
}
export declare class StreamingSessionException extends AppException {
    readonly code = "STREAM_001";
    readonly userMessage = "Streaming session error. Please try again.";
    constructor(sessionId: string, message: string, context?: Record<string, any>, cause?: Error);
}
export declare class DatabaseConnectionException extends AppException {
    readonly code = "DB_001";
    readonly userMessage = "Database connection failed. Please try again later.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class DocumentNotFoundException extends AppException {
    readonly code = "DOC_001";
    readonly userMessage = "The requested document was not found.";
    constructor(documentId: string, context?: Record<string, any>, cause?: Error);
}
export declare class FileUploadException extends AppException {
    readonly code = "FILE_001";
    readonly userMessage = "File upload failed. Please check the file and try again.";
    constructor(fileName: string, message: string, context?: Record<string, any>, cause?: Error);
}
export declare class BedrockServiceException extends AppException {
    readonly code = "BEDROCK_001";
    readonly userMessage = "AI service is temporarily unavailable. Please try again later.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class RedisConnectionException extends AppException {
    readonly code = "REDIS_001";
    readonly userMessage = "Cache service is temporarily unavailable. Please try again later.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class WebSocketException extends AppException {
    readonly code = "WS_001";
    readonly userMessage = "WebSocket connection error. Please refresh the page.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class ValidationException extends AppException {
    readonly code = "VALIDATION_001";
    readonly userMessage = "Invalid input data. Please check your input and try again.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class RateLimitException extends AppException {
    readonly code = "RATE_001";
    readonly userMessage = "Too many requests. Please wait a moment and try again.";
    constructor(limit: number, windowMs: number, context?: Record<string, any>, cause?: Error);
}
export declare class SystemOverloadException extends AppException {
    readonly code = "SYSTEM_001";
    readonly userMessage = "System is temporarily overloaded. Please try again later.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class ConfigurationException extends AppException {
    readonly code = "CONFIG_001";
    readonly userMessage = "System configuration error. Please contact support.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class EmbeddingCreationException extends AppException {
    readonly code = "EMBEDDING_001";
    readonly userMessage = "Failed to create embeddings. Please try again.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class VectorSearchException extends AppException {
    readonly code = "EMBEDDING_002";
    readonly userMessage = "Search operation failed. Please try again.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class SemanticCacheException extends AppException {
    readonly code = "EMBEDDING_003";
    readonly userMessage = "Cache operation failed. Please try again.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class BatchProcessingException extends AppException {
    readonly code = "EMBEDDING_004";
    readonly userMessage = "Batch processing failed. Please try again.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class EmbeddingAnalyticsException extends AppException {
    readonly code = "EMBEDDING_005";
    readonly userMessage = "Analytics generation failed. Please try again.";
    constructor(message: string, context?: Record<string, any>, cause?: Error);
}
export declare class ExceptionFactory {
    static authentication(message?: string, context?: Record<string, any>, cause?: Error): AuthenticationException;
    static authorization(message?: string, context?: Record<string, any>, cause?: Error): AuthorizationException;
    static tokenExpired(message?: string, context?: Record<string, any>, cause?: Error): TokenExpiredException;
    static agentNotFound(agentId: string, context?: Record<string, any>, cause?: Error): AgentNotFoundException;
    static agentExecution(message: string, context?: Record<string, any>, cause?: Error): AgentExecutionException;
    static toolExecution(toolName: string, message: string, context?: Record<string, any>, cause?: Error): ToolExecutionException;
    static chatNotFound(chatId: string, context?: Record<string, any>, cause?: Error): ChatNotFoundException;
    static messageTooLong(length: number, maxLength: number, context?: Record<string, any>, cause?: Error): MessageTooLongException;
    static streamingSession(sessionId: string, message: string, context?: Record<string, any>, cause?: Error): StreamingSessionException;
    static bedrockService(message: string, context?: Record<string, any>, cause?: Error): BedrockServiceException;
    static validation(message: string, context?: Record<string, any>, cause?: Error): ValidationException;
    static rateLimit(limit: number, windowMs: number, context?: Record<string, any>, cause?: Error): RateLimitException;
    static systemOverload(message: string, context?: Record<string, any>, cause?: Error): SystemOverloadException;
    static embeddingCreation(message: string, context?: Record<string, any>, cause?: Error): EmbeddingCreationException;
    static vectorSearch(message: string, context?: Record<string, any>, cause?: Error): VectorSearchException;
    static semanticCache(message: string, context?: Record<string, any>, cause?: Error): SemanticCacheException;
    static batchProcessing(message: string, context?: Record<string, any>, cause?: Error): BatchProcessingException;
    static embeddingAnalytics(message: string, context?: Record<string, any>, cause?: Error): EmbeddingAnalyticsException;
}
