"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExceptionFactory = exports.EmbeddingAnalyticsException = exports.BatchProcessingException = exports.SemanticCacheException = exports.VectorSearchException = exports.EmbeddingCreationException = exports.ConfigurationException = exports.SystemOverloadException = exports.RateLimitException = exports.ValidationException = exports.WebSocketException = exports.RedisConnectionException = exports.BedrockServiceException = exports.FileUploadException = exports.DocumentNotFoundException = exports.DatabaseConnectionException = exports.StreamingSessionException = exports.MessageTooLongException = exports.ChatNotFoundException = exports.ToolExecutionException = exports.AgentExecutionException = exports.AgentNotFoundException = exports.TokenExpiredException = exports.AuthorizationException = exports.AuthenticationException = exports.AppException = void 0;
const common_1 = require("@nestjs/common");
class AppException extends common_1.HttpException {
    constructor(message, status, context, errorCause) {
        super(message, status);
        this.context = context;
        this.errorCause = errorCause;
        this.name = this.constructor.name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    toJSON() {
        var _a;
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            status: this.getStatus(),
            context: this.context,
            timestamp: new Date().toISOString(),
            cause: (_a = this.errorCause) === null || _a === void 0 ? void 0 : _a.message,
        };
    }
}
exports.AppException = AppException;
class AuthenticationException extends AppException {
    constructor(message = 'Authentication failed', context, cause) {
        super(message, common_1.HttpStatus.UNAUTHORIZED, context, cause);
        this.code = 'AUTH_001';
        this.userMessage = 'Authentication failed. Please check your credentials.';
    }
}
exports.AuthenticationException = AuthenticationException;
class AuthorizationException extends AppException {
    constructor(message = 'Access denied', context, cause) {
        super(message, common_1.HttpStatus.FORBIDDEN, context, cause);
        this.code = 'AUTH_002';
        this.userMessage = 'You do not have permission to access this resource.';
    }
}
exports.AuthorizationException = AuthorizationException;
class TokenExpiredException extends AppException {
    constructor(message = 'Token expired', context, cause) {
        super(message, common_1.HttpStatus.UNAUTHORIZED, context, cause);
        this.code = 'AUTH_003';
        this.userMessage = 'Your session has expired. Please log in again.';
    }
}
exports.TokenExpiredException = TokenExpiredException;
class AgentNotFoundException extends AppException {
    constructor(agentId, context, cause) {
        super(`Agent not found: ${agentId}`, common_1.HttpStatus.NOT_FOUND, { agentId, ...context }, cause);
        this.code = 'AGENT_001';
        this.userMessage = 'The requested agent was not found.';
    }
}
exports.AgentNotFoundException = AgentNotFoundException;
class AgentExecutionException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'AGENT_002';
        this.userMessage = 'Agent execution failed. Please try again.';
    }
}
exports.AgentExecutionException = AgentExecutionException;
class ToolExecutionException extends AppException {
    constructor(toolName, message, context, cause) {
        super(`Tool '${toolName}' execution failed: ${message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR, { toolName, ...context }, cause);
        this.code = 'TOOL_001';
        this.userMessage = 'Tool execution failed. Please try again.';
    }
}
exports.ToolExecutionException = ToolExecutionException;
class ChatNotFoundException extends AppException {
    constructor(chatId, context, cause) {
        super(`Chat not found: ${chatId}`, common_1.HttpStatus.NOT_FOUND, { chatId, ...context }, cause);
        this.code = 'CHAT_001';
        this.userMessage = 'The requested chat was not found.';
    }
}
exports.ChatNotFoundException = ChatNotFoundException;
class MessageTooLongException extends AppException {
    constructor(length, maxLength, context, cause) {
        super(`Message too long: ${length} characters (max: ${maxLength})`, common_1.HttpStatus.BAD_REQUEST, { length, maxLength, ...context }, cause);
        this.code = 'CHAT_002';
        this.userMessage = 'Your message is too long. Please shorten it and try again.';
    }
}
exports.MessageTooLongException = MessageTooLongException;
class StreamingSessionException extends AppException {
    constructor(sessionId, message, context, cause) {
        super(`Streaming session '${sessionId}' error: ${message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR, { sessionId, ...context }, cause);
        this.code = 'STREAM_001';
        this.userMessage = 'Streaming session error. Please try again.';
    }
}
exports.StreamingSessionException = StreamingSessionException;
class DatabaseConnectionException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.SERVICE_UNAVAILABLE, context, cause);
        this.code = 'DB_001';
        this.userMessage = 'Database connection failed. Please try again later.';
    }
}
exports.DatabaseConnectionException = DatabaseConnectionException;
class DocumentNotFoundException extends AppException {
    constructor(documentId, context, cause) {
        super(`Document not found: ${documentId}`, common_1.HttpStatus.NOT_FOUND, { documentId, ...context }, cause);
        this.code = 'DOC_001';
        this.userMessage = 'The requested document was not found.';
    }
}
exports.DocumentNotFoundException = DocumentNotFoundException;
class FileUploadException extends AppException {
    constructor(fileName, message, context, cause) {
        super(`File upload failed '${fileName}': ${message}`, common_1.HttpStatus.BAD_REQUEST, { fileName, ...context }, cause);
        this.code = 'FILE_001';
        this.userMessage = 'File upload failed. Please check the file and try again.';
    }
}
exports.FileUploadException = FileUploadException;
class BedrockServiceException extends AppException {
    constructor(message, context, cause) {
        super(`Bedrock service error: ${message}`, common_1.HttpStatus.SERVICE_UNAVAILABLE, context, cause);
        this.code = 'BEDROCK_001';
        this.userMessage = 'AI service is temporarily unavailable. Please try again later.';
    }
}
exports.BedrockServiceException = BedrockServiceException;
class RedisConnectionException extends AppException {
    constructor(message, context, cause) {
        super(`Redis connection error: ${message}`, common_1.HttpStatus.SERVICE_UNAVAILABLE, context, cause);
        this.code = 'REDIS_001';
        this.userMessage = 'Cache service is temporarily unavailable. Please try again later.';
    }
}
exports.RedisConnectionException = RedisConnectionException;
class WebSocketException extends AppException {
    constructor(message, context, cause) {
        super(`WebSocket error: ${message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'WS_001';
        this.userMessage = 'WebSocket connection error. Please refresh the page.';
    }
}
exports.WebSocketException = WebSocketException;
class ValidationException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.BAD_REQUEST, context, cause);
        this.code = 'VALIDATION_001';
        this.userMessage = 'Invalid input data. Please check your input and try again.';
    }
}
exports.ValidationException = ValidationException;
class RateLimitException extends AppException {
    constructor(limit, windowMs, context, cause) {
        super(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`, common_1.HttpStatus.TOO_MANY_REQUESTS, { limit, windowMs, ...context }, cause);
        this.code = 'RATE_001';
        this.userMessage = 'Too many requests. Please wait a moment and try again.';
    }
}
exports.RateLimitException = RateLimitException;
class SystemOverloadException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.SERVICE_UNAVAILABLE, context, cause);
        this.code = 'SYSTEM_001';
        this.userMessage = 'System is temporarily overloaded. Please try again later.';
    }
}
exports.SystemOverloadException = SystemOverloadException;
class ConfigurationException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'CONFIG_001';
        this.userMessage = 'System configuration error. Please contact support.';
    }
}
exports.ConfigurationException = ConfigurationException;
class EmbeddingCreationException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'EMBEDDING_001';
        this.userMessage = 'Failed to create embeddings. Please try again.';
    }
}
exports.EmbeddingCreationException = EmbeddingCreationException;
class VectorSearchException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'EMBEDDING_002';
        this.userMessage = 'Search operation failed. Please try again.';
    }
}
exports.VectorSearchException = VectorSearchException;
class SemanticCacheException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'EMBEDDING_003';
        this.userMessage = 'Cache operation failed. Please try again.';
    }
}
exports.SemanticCacheException = SemanticCacheException;
class BatchProcessingException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'EMBEDDING_004';
        this.userMessage = 'Batch processing failed. Please try again.';
    }
}
exports.BatchProcessingException = BatchProcessingException;
class EmbeddingAnalyticsException extends AppException {
    constructor(message, context, cause) {
        super(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
        this.code = 'EMBEDDING_005';
        this.userMessage = 'Analytics generation failed. Please try again.';
    }
}
exports.EmbeddingAnalyticsException = EmbeddingAnalyticsException;
class ExceptionFactory {
    static authentication(message, context, cause) {
        return new AuthenticationException(message, context, cause);
    }
    static authorization(message, context, cause) {
        return new AuthorizationException(message, context, cause);
    }
    static tokenExpired(message, context, cause) {
        return new TokenExpiredException(message, context, cause);
    }
    static agentNotFound(agentId, context, cause) {
        return new AgentNotFoundException(agentId, context, cause);
    }
    static agentExecution(message, context, cause) {
        return new AgentExecutionException(message, context, cause);
    }
    static toolExecution(toolName, message, context, cause) {
        return new ToolExecutionException(toolName, message, context, cause);
    }
    static chatNotFound(chatId, context, cause) {
        return new ChatNotFoundException(chatId, context, cause);
    }
    static messageTooLong(length, maxLength, context, cause) {
        return new MessageTooLongException(length, maxLength, context, cause);
    }
    static streamingSession(sessionId, message, context, cause) {
        return new StreamingSessionException(sessionId, message, context, cause);
    }
    static bedrockService(message, context, cause) {
        return new BedrockServiceException(message, context, cause);
    }
    static validation(message, context, cause) {
        return new ValidationException(message, context, cause);
    }
    static rateLimit(limit, windowMs, context, cause) {
        return new RateLimitException(limit, windowMs, context, cause);
    }
    static systemOverload(message, context, cause) {
        return new SystemOverloadException(message, context, cause);
    }
    static embeddingCreation(message, context, cause) {
        return new EmbeddingCreationException(message, context, cause);
    }
    static vectorSearch(message, context, cause) {
        return new VectorSearchException(message, context, cause);
    }
    static semanticCache(message, context, cause) {
        return new SemanticCacheException(message, context, cause);
    }
    static batchProcessing(message, context, cause) {
        return new BatchProcessingException(message, context, cause);
    }
    static embeddingAnalytics(message, context, cause) {
        return new EmbeddingAnalyticsException(message, context, cause);
    }
}
exports.ExceptionFactory = ExceptionFactory;
//# sourceMappingURL=app-exceptions.js.map