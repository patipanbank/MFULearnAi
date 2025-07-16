import { Server, Socket } from 'socket.io';
export interface ChatMessage {
    sessionId: string;
    message: string;
    timestamp: Date;
    userId: string;
    username: string;
    type: 'user' | 'ai' | 'system';
}
export declare class RedisPubSubService {
    private readonly logger;
    private subscriber;
    private publisher;
    private activeConnections;
    private socketServer;
    private isListening;
    constructor();
    private initializeRedis;
    setSocketServer(server: Server): void;
    private startRedisListener;
    private broadcastToSession;
    connect(sessionId: string, socket: Socket): Promise<void>;
    disconnect(sessionId: string, socket: Socket): void;
    publishChatMessage(sessionId: string, message: any): Promise<void>;
    broadcastToUser(userId: string, event: string, data: any): Promise<void>;
    broadcastToRoom(room: string, event: string, data: any): Promise<void>;
    getConnectionStats(): {
        activeSessions: number;
        totalConnections: number;
        sessions: string[];
    };
    onDestroy(): Promise<void>;
}
