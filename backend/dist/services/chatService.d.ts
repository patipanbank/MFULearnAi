import { Chat, ChatMessage } from '../models/chat';
export declare class ChatService {
    constructor();
    createChat(userId: string, name: string, agentId?: string): Promise<Chat>;
    getChat(chatId: string, userId: string): Promise<Chat | null>;
    addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage>;
    processMessage(chatId: string, userId: string, content: string, images?: Array<{
        url: string;
        mediaType: string;
    }>): Promise<void>;
    private processWithAILegacy;
    private streamResponse;
    private streamResponseLegacy;
    private generateResponse;
    private generateDetailedResponse;
    private delay;
    getUserChats(userId: string): Promise<Chat[]>;
    deleteChat(chatId: string, userId: string): Promise<boolean>;
    updateChatName(chatId: string, userId: string, name: string): Promise<Chat | null>;
    updateChatPinStatus(chatId: string, userId: string, isPinned: boolean): Promise<Chat | null>;
    clearChatMemory(chatId: string): Promise<void>;
    private getRecentMessagesFromRedis;
    private setRecentMessagesToRedis;
    private restoreRecentContextIfNeeded;
    private embedMessagesIfNeeded;
    private shouldUseMemoryTool;
    private shouldUseRedisMemory;
    private shouldEmbedMessages;
    getStats(): any;
}
export declare const chatService: ChatService;
//# sourceMappingURL=chatService.d.ts.map