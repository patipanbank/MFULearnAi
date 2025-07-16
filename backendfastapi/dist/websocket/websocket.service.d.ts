import { RedisService } from '../redis/redis.service';
import { Socket } from 'socket.io';
interface ConnectedUser {
    id: string;
    username: string;
    role: string;
    department: string;
    socket: Socket;
    lastSeen: Date;
}
export declare class WebSocketService {
    private readonly redisService;
    private readonly logger;
    private connectedUsers;
    private userSockets;
    constructor(redisService: RedisService);
    handleConnection(client: Socket, userId: string, userInfo: any): Promise<void>;
    handleDisconnection(client: Socket): Promise<void>;
    sendToUser(userId: string, event: string, data: any): Promise<boolean>;
    broadcastToRoom(room: string, event: string, data: any): Promise<void>;
    broadcastUserStatus(userId: string, status: 'online' | 'offline'): Promise<void>;
    getConnectedUsers(): ConnectedUser[];
    getUserSocketCount(userId: string): number;
    isUserOnline(userId: string): boolean;
    joinRoom(client: Socket, room: string): Promise<void>;
    leaveRoom(client: Socket, room: string): Promise<void>;
}
export {};
