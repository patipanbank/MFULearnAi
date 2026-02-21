import { getIO } from '../socket';

/**
 * AgentEventStore — Emits agent workflow events via Socket.IO.
 *
 * Replaces `res.write(SSE)` with `io.to(user:userId).emit('agent:event', ...)`.
 * Also maintains an in-memory event log for MongoDB persistence.
 */
export class AgentEventStore {
    private userId: string;
    private traceId: string;
    private eventLog: any[] = [];

    constructor(userId: string, traceId: string) {
        this.userId = userId;
        this.traceId = traceId;
    }

    /**
     * Emit an event to the connected client via Socket.IO
     * and store non-delta events for MongoDB persistence.
     */
    emit(type: string, payload: Record<string, any> = {}): void {
        const event = {
            type,
            ...payload,
            traceId: this.traceId,
            timestamp: new Date().toISOString()
        };

        try {
            const io = getIO();
            io.to(`user:${this.userId}`).emit('agent:event', event);
        } catch (err) {
            console.error(`[AgentEventStore] Failed to emit event: ${type}`, err);
        }

        // Store for MongoDB persistence (skip high-frequency deltas and transient UI signals)
        const SKIP_PERSISTENCE = new Set(['answer_delta', 'thinking_delta', 'content_reset', 'status']);
        if (!SKIP_PERSISTENCE.has(type)) {
            this.eventLog.push(event);
        }
    }

    /**
     * Get stored event log for MongoDB persistence.
     */
    getEventLog(): any[] {
        return this.eventLog;
    }
}
