import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
interface WebSocketConnection {
    ws: WebSocket;
    userId: string;
    sessionId?: string;
    isAlive: boolean;
}
export declare class WebSocketManager extends EventEmitter {
    private connections;
    private sessionConnections;
    private redisClient;
    private redisSubscriber;
    private isRedisConnected;
    constructor();
    private initializeRedis;
    addConnection(connectionId: string, ws: WebSocket, userId: string): void;
    joinSession(connectionId: string, sessionId: string): void;
    leaveSession(connectionId: string): void;
    removeConnection(connectionId: string): void;
    sendToConnection(connectionId: string, message: string): boolean;
    broadcastToSession(sessionId: string, message: string): void;
    broadcastToUser(userId: string, message: string): void;
    publishToRedis(channel: string, message: string): void;
    getConnectionCount(): number;
    getSessionConnectionCount(sessionId: string): number;
    getConnectionInfo(connectionId: string): WebSocketConnection | undefined;
    pingConnections(): void;
    cleanup(): Promise<void>;
}
export declare const wsManager: WebSocketManager;
export {};
//# sourceMappingURL=websocketManager.d.ts.map