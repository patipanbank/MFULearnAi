import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class StreamingService {
    private readonly eventEmitter;
    private readonly logger;
    private readonly activeStreams;
    constructor(eventEmitter: EventEmitter2);
    startStream(sessionId: string, executionId: string, agentId: string, userId: string, message: string): void;
    emitChunk(sessionId: string, chunk: string, tokenInfo?: {
        input?: number;
        output?: number;
    }): void;
    emitToolCall(sessionId: string, toolName: string, toolParams: any, reasoning?: string): void;
    emitToolResult(sessionId: string, toolName: string, result: any, success: boolean, error?: string): void;
    completeStream(sessionId: string, finalResponse?: string): void;
    emitError(sessionId: string, error: string, code?: string, details?: any): void;
    getSession(sessionId: string): StreamingSession | undefined;
    isSessionActive(sessionId: string): boolean;
    getActiveSessions(): string[];
    cancelStream(sessionId: string): void;
    private emitStreamEvent;
}
interface StreamingSession {
    sessionId: string;
    executionId: string;
    agentId: string;
    userId: string;
    startTime: number;
    isActive: boolean;
    accumulatedResponse: string;
    toolsUsed: string[];
    tokenUsage: {
        input: number;
        output: number;
    };
}
export {};
