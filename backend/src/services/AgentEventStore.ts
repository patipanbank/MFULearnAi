import { getIO } from '../socket';
import { AgentEventType } from '../workflows/types/AgentTypes';

/**
 * AgentEventStore — Emits agent workflow events via Socket.IO.
 *
 * Events are pushed to the client's room: `io.to(user:userId).emit('agent:event', ...)`
 * Also maintains an in-memory event log for MongoDB persistence.
 * Monitors client disconnect to allow the workflow to abort early.
 */
export class AgentEventStore {
    private userId: string;
    private traceId: string;
    private eventLog: Array<{ type: string; timestamp: string; [key: string]: unknown }> = [];
    private _clientDisconnected = false;

    /** Callback invoked when the client disconnects mid-workflow */
    onDisconnect?: () => void;

    constructor(userId: string, traceId: string) {
        this.userId = userId;
        this.traceId = traceId;
        this.watchDisconnect();
    }

    /** True when the target user has no connected sockets */
    get clientDisconnected(): boolean {
        return this._clientDisconnected;
    }

    /**
     * Emit a typed event to the connected client via Socket.IO
     * and store non-delta events for MongoDB persistence.
     */
    emit(type: AgentEventType | string, payload: Record<string, unknown> = {}): void {
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
        const SKIP_PERSISTENCE = new Set(['answer_delta', 'thinking_delta', 'block_delta', 'content_reset', 'status']);
        if (!SKIP_PERSISTENCE.has(type)) {
            this.eventLog.push(event);
        }
    }

    /** Get stored event log for MongoDB persistence. */
    getEventLog(): Array<{ type: string; timestamp: string; [key: string]: unknown }> {
        return this.eventLog;
    }

    /**
     * Watch for Socket.IO disconnects on the user's room.
     * Sets the flag so the agent loop can break early.
     */
    private watchDisconnect(): void {
        try {
            const io = getIO();
            const room = `user:${this.userId}`;

            // Check periodically if the room is empty
            const interval = setInterval(async () => {
                try {
                    const sockets = await io.in(room).fetchSockets();
                    if (sockets.length === 0) {
                        this._clientDisconnected = true;
                        this.onDisconnect?.();
                        clearInterval(interval);
                    }
                } catch {
                    // Socket.IO not ready yet — ignore
                }
            }, 2_000);

            // Self-cleanup after 10 minutes (max workflow lifetime)
            setTimeout(() => clearInterval(interval), 600_000);
        } catch {
            // Socket.IO not initialized (e.g. testing) — no-op
        }
    }
}
