"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StreamingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
let StreamingService = StreamingService_1 = class StreamingService {
    constructor(eventEmitter) {
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(StreamingService_1.name);
        this.activeStreams = new Map();
    }
    startStream(sessionId, executionId, agentId, userId, message) {
        const session = {
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
        const startEvent = {
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
    emitChunk(sessionId, chunk, tokenInfo) {
        const session = this.activeStreams.get(sessionId);
        if (!session || !session.isActive) {
            this.logger.warn(`Attempted to emit chunk for inactive session: ${sessionId}`);
            return;
        }
        session.accumulatedResponse += chunk;
        if (tokenInfo) {
            if (tokenInfo.input)
                session.tokenUsage.input += tokenInfo.input;
            if (tokenInfo.output)
                session.tokenUsage.output += tokenInfo.output;
        }
        const chunkEvent = {
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
    emitToolCall(sessionId, toolName, toolParams, reasoning) {
        const session = this.activeStreams.get(sessionId);
        if (!session || !session.isActive) {
            this.logger.warn(`Attempted to emit tool call for inactive session: ${sessionId}`);
            return;
        }
        const toolCallEvent = {
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
    emitToolResult(sessionId, toolName, result, success, error) {
        const session = this.activeStreams.get(sessionId);
        if (!session || !session.isActive) {
            this.logger.warn(`Attempted to emit tool result for inactive session: ${sessionId}`);
            return;
        }
        if (success && !session.toolsUsed.includes(toolName)) {
            session.toolsUsed.push(toolName);
        }
        const toolResultEvent = {
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
    completeStream(sessionId, finalResponse) {
        const session = this.activeStreams.get(sessionId);
        if (!session || !session.isActive) {
            this.logger.warn(`Attempted to complete inactive session: ${sessionId}`);
            return;
        }
        session.isActive = false;
        const executionTime = Date.now() - session.startTime;
        const completeEvent = {
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
        setTimeout(() => {
            this.activeStreams.delete(sessionId);
        }, 5000);
        this.logger.log(`✅ Stream completed for session: ${sessionId}, duration: ${executionTime}ms`);
    }
    emitError(sessionId, error, code, details) {
        const session = this.activeStreams.get(sessionId);
        if (!session) {
            this.logger.warn(`Attempted to emit error for unknown session: ${sessionId}`);
            return;
        }
        session.isActive = false;
        const errorEvent = {
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
        setTimeout(() => {
            this.activeStreams.delete(sessionId);
        }, 1000);
        this.logger.error(`❌ Stream error for session: ${sessionId}, error: ${error}`);
    }
    getSession(sessionId) {
        return this.activeStreams.get(sessionId);
    }
    isSessionActive(sessionId) {
        const session = this.activeStreams.get(sessionId);
        return (session === null || session === void 0 ? void 0 : session.isActive) || false;
    }
    getActiveSessions() {
        return Array.from(this.activeStreams.keys()).filter(sessionId => { var _a; return (_a = this.activeStreams.get(sessionId)) === null || _a === void 0 ? void 0 : _a.isActive; });
    }
    cancelStream(sessionId) {
        const session = this.activeStreams.get(sessionId);
        if (session && session.isActive) {
            this.emitError(sessionId, 'Stream cancelled by user', 'CANCELLED');
        }
    }
    emitStreamEvent(sessionId, event) {
        this.eventEmitter.emit('stream.event', { sessionId, event });
        this.eventEmitter.emit(`stream.${event.type}`, { sessionId, event });
    }
};
exports.StreamingService = StreamingService;
exports.StreamingService = StreamingService = StreamingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [event_emitter_1.EventEmitter2])
], StreamingService);
//# sourceMappingURL=streaming.service.js.map