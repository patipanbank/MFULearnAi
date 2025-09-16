import { Chat, ChatMessage } from '../models/chat';
export declare class ChatService {
    private errorHandler;
    constructor();
    createChat(userId: string, name: string, agentId?: string): Promise<Chat>;
    getChat(chatId: string, userId: string, includeDeleted?: boolean): Promise<Chat | null>;
    addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage>;
    private prepareImagesForMultimodal;
    processMessage(chatId: string, userId: string, content: string, images?: Array<{
        url: string;
        mediaType: string;
    }>): Promise<void>;
    private broadcastToChat;
    private processWithAISimple;
    private updateMessageContent;
    getUserChats(userId: string, includeDeleted?: boolean): Promise<Chat[]>;
    getUserDeletedChats(userId: string): Promise<Chat[]>;
    deleteChat(chatId: string, userId: string): Promise<boolean>;
    permanentlyDeleteChat(chatId: string, userId: string): Promise<boolean>;
    restoreChat(chatId: string, userId: string): Promise<Chat | null>;
    updateChatName(chatId: string, userId: string, name: string): Promise<Chat | null>;
    updateChatPinStatus(chatId: string, userId: string, isPinned: boolean): Promise<Chat | null>;
    deleteMessage(chatId: string, messageId: string, userId: string): Promise<boolean>;
    restoreMessage(chatId: string, messageId: string, userId: string): Promise<boolean>;
    getChatWithActiveMessages(chatId: string, userId: string): Promise<Chat | null>;
    clearChatMemory(chatId: string): Promise<void>;
    private shouldUseMemoryTool;
    private shouldUseRedisMemory;
    private shouldEmbedMessages;
    getStats(): any;
    getAgentCacheStats(): {
        totalEntries: number;
        maxSize: number;
        ttlMs: number;
        entries: Array<{
            hitCount: number;
            age: string;
            lastUsed: string;
        }>;
    };
    clearAgentCache(): void;
}
export declare const chatService: ChatService;
//# sourceMappingURL=chatService.d.ts.map