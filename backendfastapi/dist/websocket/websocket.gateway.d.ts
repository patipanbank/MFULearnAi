import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { WebSocketService } from './websocket.service';
import { ChatService } from '../chat/chat.service';
import { ChatHistoryService } from '../chat/chat-history.service';
import { AgentService } from '../agent/agent.service';
import { TaskQueueService } from '../tasks/task-queue.service';
import { RedisPubSubService } from '../redis/redis-pubsub.service';
interface JoinRoomMessage {
    type: 'join_room';
    chatId: string;
}
interface CreateRoomMessage {
    type: 'create_room';
    agent_id?: string;
    agentId?: string;
    model_id?: string;
    modelId?: string;
    collection_names?: string[];
    collectionNames?: string[];
    system_prompt?: string;
    systemPrompt?: string;
    temperature?: number;
    max_tokens?: number;
    maxTokens?: number;
}
interface SendMessageMessage {
    type: 'send_message';
    message: string;
    images?: any[];
}
export declare class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    private jwtService;
    private configService;
    private webSocketService;
    private chatService;
    private chatHistoryService;
    private agentService;
    private taskQueueService;
    private redisPubSubService;
    server: Server;
    constructor(jwtService: JwtService, configService: ConfigService, webSocketService: WebSocketService, chatService: ChatService, chatHistoryService: ChatHistoryService, agentService: AgentService, taskQueueService: TaskQueueService, redisPubSubService: RedisPubSubService);
    afterInit(server: Server): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinRoom(data: JoinRoomMessage, client: Socket): Promise<void>;
    handleCreateRoom(data: CreateRoomMessage, client: Socket): Promise<void>;
    handleSendMessage(data: SendMessageMessage, client: Socket): Promise<void>;
    handleLeaveRoom(client: Socket): Promise<void>;
}
export {};
