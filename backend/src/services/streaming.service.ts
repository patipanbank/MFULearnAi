import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  StreamEvent, 
  StreamStartEvent, 
  StreamChunkEvent, 
  StreamToolCallEvent, 
  StreamToolResultEvent, 
  StreamCompleteEvent, 
  StreamErrorEvent 
} from '../common/schemas';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly activeStreams = new Map<string, StreamingSession>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  // Start a new streaming session
  startStream(sessionId: string, executionId: string, agentId: string, userId: string, message: string): void {
    const session: StreamingSession = {
      sessionId,
      executionId,
      agentId,
      userId,
      startTime: Date.now(),
      isActive: true,
      accumulatedResponse: '',
      toolsUsed: [],
      tokenUsage: { input: 0, output: 0 },
    };

    this.activeStreams.set(sessionId, session);

    const startEvent: StreamStartEvent = {
      sessionId,
      executionId,
      timestamp: new Date(),
      type: 'stream_start',
      data: {
        agentId,
        userId,
        message,
      },
    };

    this.emitStreamEvent(sessionId, startEvent);
    this.logger.debug(`🚀 Stream started for session: ${sessionId}`);
  }

  // Emit a text chunk
  emitChunk(sessionId: string, chunk: string, tokenInfo?: { input?: number; output?: number }): void {
    const session = this.activeStreams.get(sessionId);
    if (!session || !session.isActive) {
      this.logger.warn(`Attempted to emit chunk for inactive session: ${sessionId}`);
      return;
    }

    // Update accumulated response
    session.accumulatedResponse += chunk;
    
    // Update token usage
    if (tokenInfo) {
      if (tokenInfo.input) session.tokenUsage.input += tokenInfo.input;
      if (tokenInfo.output) session.tokenUsage.output += tokenInfo.output;
    }

    const chunkEvent: StreamChunkEvent = {
      sessionId,
      executionId: session.executionId,
      timestamp: new Date(),
      type: 'stream_chunk',
      data: {
        chunk,
        accumulated: session.accumulatedResponse,
        tokens: tokenInfo,
      },
    };

    this.emitStreamEvent(sessionId, chunkEvent);
  }

  // Emit tool call event
  emitToolCall(sessionId: string, toolName: string, toolParams: any, reasoning?: string): void {
    const session = this.activeStreams.get(sessionId);
    if (!session || !session.isActive) {
      this.logger.warn(`Attempted to emit tool call for inactive session: ${sessionId}`);
      return;
    }

    const toolCallEvent: StreamToolCallEvent = {
      sessionId,
      executionId: session.executionId,
      timestamp: new Date(),
      type: 'stream_tool_call',
      data: {
        toolName,
        toolParams,
        reasoning,
      },
    };

    this.emitStreamEvent(sessionId, toolCallEvent);
    this.logger.debug(`🔧 Tool call emitted for session: ${sessionId}, tool: ${toolName}`);
  }

  // Emit tool result event
  emitToolResult(sessionId: string, toolName: string, result: any, success: boolean, error?: string): void {
    const session = this.activeStreams.get(sessionId);
    if (!session || !session.isActive) {
      this.logger.warn(`Attempted to emit tool result for inactive session: ${sessionId}`);
      return;
    }

    if (success && !session.toolsUsed.includes(toolName)) {
      session.toolsUsed.push(toolName);
    }

    const toolResultEvent: StreamToolResultEvent = {
      sessionId,
      executionId: session.executionId,
      timestamp: new Date(),
      type: 'stream_tool_result',
      data: {
        toolName,
        result,
        success,
        error,
      },
    };

    this.emitStreamEvent(sessionId, toolResultEvent);
    this.logger.debug(`⚙️ Tool result emitted for session: ${sessionId}, tool: ${toolName}, success: ${success}`);
  }

  // Complete the stream
  completeStream(sessionId: string, finalResponse?: string): void {
    const session = this.activeStreams.get(sessionId);
    if (!session || !session.isActive) {
      this.logger.warn(`Attempted to complete inactive session: ${sessionId}`);
      return;
    }

    session.isActive = false;
    const executionTime = Date.now() - session.startTime;

    const completeEvent: StreamCompleteEvent = {
      sessionId,
      executionId: session.executionId,
      timestamp: new Date(),
      type: 'stream_complete',
      data: {
        finalResponse: finalResponse || session.accumulatedResponse,
        toolsUsed: session.toolsUsed,
        tokenUsage: session.tokenUsage,
        executionTime,
      },
    };

    this.emitStreamEvent(sessionId, completeEvent);
    
    // Clean up after a delay to allow final events to be processed
    setTimeout(() => {
      this.activeStreams.delete(sessionId);
    }, 5000);

    this.logger.log(`✅ Stream completed for session: ${sessionId}, duration: ${executionTime}ms`);
  }

  // Emit error event
  emitError(sessionId: string, error: string, code?: string, details?: any): void {
    const session = this.activeStreams.get(sessionId);
    if (!session) {
      this.logger.warn(`Attempted to emit error for unknown session: ${sessionId}`);
      return;
    }

    session.isActive = false;

    const errorEvent: StreamErrorEvent = {
      sessionId,
      executionId: session.executionId,
      timestamp: new Date(),
      type: 'stream_error',
      data: {
        error,
        code,
        details,
      },
    };

    this.emitStreamEvent(sessionId, errorEvent);
    
    // Clean up immediately on error
    setTimeout(() => {
      this.activeStreams.delete(sessionId);
    }, 1000);

    this.logger.error(`❌ Stream error for session: ${sessionId}, error: ${error}`);
  }

  // Get streaming session info
  getSession(sessionId: string): StreamingSession | undefined {
    return this.activeStreams.get(sessionId);
  }

  // Check if session is active
  isSessionActive(sessionId: string): boolean {
    const session = this.activeStreams.get(sessionId);
    return session?.isActive || false;
  }

  // Get all active sessions
  getActiveSessions(): string[] {
    return Array.from(this.activeStreams.keys()).filter(sessionId => 
      this.activeStreams.get(sessionId)?.isActive
    );
  }

  // Cancel a stream
  cancelStream(sessionId: string): void {
    const session = this.activeStreams.get(sessionId);
    if (session && session.isActive) {
      this.emitError(sessionId, 'Stream cancelled by user', 'CANCELLED');
    }
  }

  private emitStreamEvent(sessionId: string, event: StreamEvent): void {
    // Emit to event system for WebSocket gateway to pick up
    this.eventEmitter.emit('stream.event', { sessionId, event });
    
    // Also emit specific event type for targeted listeners
    this.eventEmitter.emit(`stream.${event.type}`, { sessionId, event });
  }
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