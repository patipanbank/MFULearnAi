import { Model } from 'mongoose';
import { Chat, ChatDocument } from '../models/chat.model';
import { UserDocument } from '../models/user.model';
import { RedisService } from '../redis/redis.service';
import { ChatMemoryService } from './chat-memory.service';
import { MemoryToolService } from './memory-tool.service';
import { LangChainChatService } from '../langchain/langchain-chat.service';
export interface CreateChatDto {
    title?: string;
    agentId?: string;
    department?: string;
    isPrivate?: boolean;
}
export interface SendMessageDto {
    content: string;
    role?: 'user' | 'assistant';
    agentId?: string;
    metadata?: Record<string, any>;
}
export interface GetChatsQuery {
    userId?: string;
    agentId?: string;
    department?: string;
    page?: number;
    limit?: number;
}
export declare class ChatService {
    private chatModel;
    private userModel;
    private redisService;
    private chatMemoryService;
    private memoryToolService;
    private langchainChatService;
    constructor(chatModel: Model<ChatDocument>, userModel: Model<UserDocument>, redisService: RedisService, chatMemoryService: ChatMemoryService, memoryToolService: MemoryToolService, langchainChatService: LangChainChatService);
    createChat(userId: string, createChatDto: CreateChatDto): Promise<Chat>;
    sendMessage(chatId: string, userId: string, messageDto: SendMessageDto): Promise<Chat>;
    getChats(query: GetChatsQuery): Promise<{
        chats: Chat[];
        total: number;
    }>;
    getChatById(chatId: string, userId: string): Promise<Chat>;
    deleteChat(chatId: string, userId: string): Promise<void>;
    getChatHistory(chatId: string, userId: string): Promise<any[]>;
    updateChatTitle(chatId: string, userId: string, title: string): Promise<Chat>;
    getUserChatStats(userId: string): Promise<any>;
    clearChatMemory(chatId: string, userId: string): Promise<void>;
    restoreRedisMemoryFromHistory(chatId: string): Promise<void>;
    getMemoryStats(): Promise<any>;
    pinChat(chatId: string, userId: string, isPinned: boolean): Promise<Chat>;
    generateResponse(request: {
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
    }): AsyncGenerator<string, void, unknown>;
}
