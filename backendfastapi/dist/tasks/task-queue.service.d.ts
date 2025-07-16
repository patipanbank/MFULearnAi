import { RedisService } from '../redis/redis.service';
import { ChatService } from '../chat/chat.service';
import { ChatHistoryService } from '../chat/chat-history.service';
import { RedisPubSubService } from '../redis/redis-pubsub.service';
interface ChatTaskPayload {
    sessionId: string;
    userId: string;
    message: string;
    modelId: string;
    collectionNames: string[];
    agentId?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    images?: any[];
}
export declare class TaskQueueService {
    private redisService;
    private chatService;
    private chatHistoryService;
    private redisPubSubService;
    private readonly logger;
    constructor(redisService: RedisService, chatService: ChatService, chatHistoryService: ChatHistoryService, redisPubSubService: RedisPubSubService);
    addChatTask(taskType: string, payload: ChatTaskPayload): Promise<void>;
    processChatTask(taskData: any): Promise<void>;
    generateResponse(payload: ChatTaskPayload): Promise<void>;
    getTaskStatus(taskId: string): Promise<any>;
    updateTaskStatus(taskId: string, status: any): Promise<void>;
}
export {};
