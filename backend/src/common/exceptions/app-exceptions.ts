import { HttpException, HttpStatus } from '@nestjs/common';

// Base application exception
export abstract class AppException extends HttpException {
  abstract readonly code: string;
  abstract readonly userMessage: string;
  
  constructor(
    message: string,
    status: HttpStatus,
    public readonly context?: Record<string, any>,
    public readonly errorCause?: Error
  ) {
    super(message, status);
    this.name = this.constructor.name;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      status: this.getStatus(),
      context: this.context,
      timestamp: new Date().toISOString(),
      cause: this.errorCause?.message,
    };
  }
}

// Authentication & Authorization Exceptions
export class AuthenticationException extends AppException {
  readonly code = 'AUTH_001';
  readonly userMessage = 'Authentication failed. Please check your credentials.';

  constructor(message: string = 'Authentication failed', context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.UNAUTHORIZED, context, cause);
  }
}

export class AuthorizationException extends AppException {
  readonly code = 'AUTH_002';
  readonly userMessage = 'You do not have permission to access this resource.';

  constructor(message: string = 'Access denied', context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.FORBIDDEN, context, cause);
  }
}

export class TokenExpiredException extends AppException {
  readonly code = 'AUTH_003';
  readonly userMessage = 'Your session has expired. Please log in again.';

  constructor(message: string = 'Token expired', context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.UNAUTHORIZED, context, cause);
  }
}

// Business Logic Exceptions
export class AgentNotFoundException extends AppException {
  readonly code = 'AGENT_001';
  readonly userMessage = 'The requested agent was not found.';

  constructor(agentId: string, context?: Record<string, any>, cause?: Error) {
    super(`Agent not found: ${agentId}`, HttpStatus.NOT_FOUND, { agentId, ...context }, cause);
  }
}

export class AgentExecutionException extends AppException {
  readonly code = 'AGENT_002';
  readonly userMessage = 'Agent execution failed. Please try again.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

export class ToolExecutionException extends AppException {
  readonly code = 'TOOL_001';
  readonly userMessage = 'Tool execution failed. Please try again.';

  constructor(toolName: string, message: string, context?: Record<string, any>, cause?: Error) {
    super(`Tool '${toolName}' execution failed: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, { toolName, ...context }, cause);
  }
}

// Chat & Communication Exceptions
export class ChatNotFoundException extends AppException {
  readonly code = 'CHAT_001';
  readonly userMessage = 'The requested chat was not found.';

  constructor(chatId: string, context?: Record<string, any>, cause?: Error) {
    super(`Chat not found: ${chatId}`, HttpStatus.NOT_FOUND, { chatId, ...context }, cause);
  }
}

export class MessageTooLongException extends AppException {
  readonly code = 'CHAT_002';
  readonly userMessage = 'Your message is too long. Please shorten it and try again.';

  constructor(length: number, maxLength: number, context?: Record<string, any>, cause?: Error) {
    super(`Message too long: ${length} characters (max: ${maxLength})`, HttpStatus.BAD_REQUEST, { length, maxLength, ...context }, cause);
  }
}

export class StreamingSessionException extends AppException {
  readonly code = 'STREAM_001';
  readonly userMessage = 'Streaming session error. Please try again.';

  constructor(sessionId: string, message: string, context?: Record<string, any>, cause?: Error) {
    super(`Streaming session '${sessionId}' error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, { sessionId, ...context }, cause);
  }
}

// Database & Storage Exceptions
export class DatabaseConnectionException extends AppException {
  readonly code = 'DB_001';
  readonly userMessage = 'Database connection failed. Please try again later.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE, context, cause);
  }
}

export class DocumentNotFoundException extends AppException {
  readonly code = 'DOC_001';
  readonly userMessage = 'The requested document was not found.';

  constructor(documentId: string, context?: Record<string, any>, cause?: Error) {
    super(`Document not found: ${documentId}`, HttpStatus.NOT_FOUND, { documentId, ...context }, cause);
  }
}

export class FileUploadException extends AppException {
  readonly code = 'FILE_001';
  readonly userMessage = 'File upload failed. Please check the file and try again.';

  constructor(fileName: string, message: string, context?: Record<string, any>, cause?: Error) {
    super(`File upload failed '${fileName}': ${message}`, HttpStatus.BAD_REQUEST, { fileName, ...context }, cause);
  }
}

// External Service Exceptions
export class BedrockServiceException extends AppException {
  readonly code = 'BEDROCK_001';
  readonly userMessage = 'AI service is temporarily unavailable. Please try again later.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(`Bedrock service error: ${message}`, HttpStatus.SERVICE_UNAVAILABLE, context, cause);
  }
}

export class RedisConnectionException extends AppException {
  readonly code = 'REDIS_001';
  readonly userMessage = 'Cache service is temporarily unavailable. Please try again later.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(`Redis connection error: ${message}`, HttpStatus.SERVICE_UNAVAILABLE, context, cause);
  }
}

export class WebSocketException extends AppException {
  readonly code = 'WS_001';
  readonly userMessage = 'WebSocket connection error. Please refresh the page.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(`WebSocket error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

// Validation Exceptions
export class ValidationException extends AppException {
  readonly code = 'VALIDATION_001';
  readonly userMessage = 'Invalid input data. Please check your input and try again.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.BAD_REQUEST, context, cause);
  }
}

export class RateLimitException extends AppException {
  readonly code = 'RATE_001';
  readonly userMessage = 'Too many requests. Please wait a moment and try again.';

  constructor(limit: number, windowMs: number, context?: Record<string, any>, cause?: Error) {
    super(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`, HttpStatus.TOO_MANY_REQUESTS, { limit, windowMs, ...context }, cause);
  }
}

// System Exceptions
export class SystemOverloadException extends AppException {
  readonly code = 'SYSTEM_001';
  readonly userMessage = 'System is temporarily overloaded. Please try again later.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE, context, cause);
  }
}

export class ConfigurationException extends AppException {
  readonly code = 'CONFIG_001';
  readonly userMessage = 'System configuration error. Please contact support.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

// Vector Embeddings Exceptions
export class EmbeddingCreationException extends AppException {
  readonly code = 'EMBEDDING_001';
  readonly userMessage = 'Failed to create embeddings. Please try again.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

export class VectorSearchException extends AppException {
  readonly code = 'EMBEDDING_002';
  readonly userMessage = 'Search operation failed. Please try again.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

export class SemanticCacheException extends AppException {
  readonly code = 'EMBEDDING_003';
  readonly userMessage = 'Cache operation failed. Please try again.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

export class BatchProcessingException extends AppException {
  readonly code = 'EMBEDDING_004';
  readonly userMessage = 'Batch processing failed. Please try again.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

export class EmbeddingAnalyticsException extends AppException {
  readonly code = 'EMBEDDING_005';
  readonly userMessage = 'Analytics generation failed. Please try again.';

  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, context, cause);
  }
}

// Exception factory for easy creation
export class ExceptionFactory {
  static authentication(message?: string, context?: Record<string, any>, cause?: Error) {
    return new AuthenticationException(message, context, cause);
  }

  static authorization(message?: string, context?: Record<string, any>, cause?: Error) {
    return new AuthorizationException(message, context, cause);
  }

  static tokenExpired(message?: string, context?: Record<string, any>, cause?: Error) {
    return new TokenExpiredException(message, context, cause);
  }

  static agentNotFound(agentId: string, context?: Record<string, any>, cause?: Error) {
    return new AgentNotFoundException(agentId, context, cause);
  }

  static agentExecution(message: string, context?: Record<string, any>, cause?: Error) {
    return new AgentExecutionException(message, context, cause);
  }

  static toolExecution(toolName: string, message: string, context?: Record<string, any>, cause?: Error) {
    return new ToolExecutionException(toolName, message, context, cause);
  }

  static chatNotFound(chatId: string, context?: Record<string, any>, cause?: Error) {
    return new ChatNotFoundException(chatId, context, cause);
  }

  static messageTooLong(length: number, maxLength: number, context?: Record<string, any>, cause?: Error) {
    return new MessageTooLongException(length, maxLength, context, cause);
  }

  static streamingSession(sessionId: string, message: string, context?: Record<string, any>, cause?: Error) {
    return new StreamingSessionException(sessionId, message, context, cause);
  }

  static bedrockService(message: string, context?: Record<string, any>, cause?: Error) {
    return new BedrockServiceException(message, context, cause);
  }

  static validation(message: string, context?: Record<string, any>, cause?: Error) {
    return new ValidationException(message, context, cause);
  }

  static rateLimit(limit: number, windowMs: number, context?: Record<string, any>, cause?: Error) {
    return new RateLimitException(limit, windowMs, context, cause);
  }

  static systemOverload(message: string, context?: Record<string, any>, cause?: Error) {
    return new SystemOverloadException(message, context, cause);
  }

  // Vector Embeddings Factory Methods
  static embeddingCreation(message: string, context?: Record<string, any>, cause?: Error) {
    return new EmbeddingCreationException(message, context, cause);
  }

  static vectorSearch(message: string, context?: Record<string, any>, cause?: Error) {
    return new VectorSearchException(message, context, cause);
  }

  static semanticCache(message: string, context?: Record<string, any>, cause?: Error) {
    return new SemanticCacheException(message, context, cause);
  }

  static batchProcessing(message: string, context?: Record<string, any>, cause?: Error) {
    return new BatchProcessingException(message, context, cause);
  }

  static embeddingAnalytics(message: string, context?: Record<string, any>, cause?: Error) {
    return new EmbeddingAnalyticsException(message, context, cause);
  }
} 