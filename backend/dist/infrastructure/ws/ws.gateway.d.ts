import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserService } from '../../modules/users/user.service';
import { WsAuthMiddleware } from '../../modules/auth/ws-auth.middleware';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { JoinRoomDto, LeaveRoomDto, TypingStartDto, TypingStopDto, WsMessageDto, WsStreamSubscribeDto, WsStreamUnsubscribeDto, StreamEvent } from '../../common/schemas';
export declare class WsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly redis;
    private readonly jwtService;
    private readonly userService;
    private readonly wsAuthMiddleware;
    private readonly eventEmitter;
    server: Server;
    private readonly logger;
    private connectedUsers;
    private streamingSessions;
    constructor(redis: Redis, jwtService: JwtService, userService: UserService, wsAuthMiddleware: WsAuthMiddleware, eventEmitter: EventEmitter2);
    afterInit(server: Server): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handlePing(data: string, client: Socket): {
        event: string;
        data: string;
    };
    handleJoinRoom(data: JoinRoomDto, client: Socket): Promise<void>;
    handleLeaveRoom(data: LeaveRoomDto, client: Socket): Promise<void>;
    handleSendMessage(data: WsMessageDto, client: Socket): Promise<void>;
    handleTypingStart(data: TypingStartDto, client: Socket): Promise<void>;
    handleTypingStop(data: TypingStopDto, client: Socket): Promise<void>;
    broadcastToUser(userId: string, event: string, data: any): Promise<void>;
    broadcastToChat(chatId: string, event: string, data: any): Promise<void>;
    getOnlineUsersCount(): number;
    getOnlineUsersInChat(chatId: string): Promise<string[]>;
    handleSubscribeStream(data: WsStreamSubscribeDto, client: Socket): Promise<void>;
    handleUnsubscribeStream(data: WsStreamUnsubscribeDto, client: Socket): Promise<void>;
    handleStreamEvent(payload: {
        sessionId: string;
        event: StreamEvent;
    }): void;
    handleStreamStart(payload: {
        sessionId: string;
        event: StreamEvent;
    }): void;
    handleStreamChunk(payload: {
        sessionId: string;
        event: StreamEvent;
    }): void;
    handleStreamToolCall(payload: {
        sessionId: string;
        event: StreamEvent;
    }): void;
    handleStreamToolResult(payload: {
        sessionId: string;
        event: StreamEvent;
    }): void;
    handleStreamComplete(payload: {
        sessionId: string;
        event: StreamEvent;
    }): void;
    handleStreamError(payload: {
        sessionId: string;
        event: StreamEvent;
    }): void;
    getStreamingSessionInfo(sessionId: string): {
        subscriberCount: number;
        socketIds: string[];
    };
}
