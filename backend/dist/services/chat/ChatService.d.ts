import { Chat, ChatMessage } from '../../models/chat';
export declare class ChatService {
    constructor();
    createChat(userId: string, name: string, agentId?: string): Promise<Chat>;
    getChat(chatId: string, userId: string): Promise<Chat | null>;
    getUserChats(userId: string): Promise<Chat[]>;
    deleteChat(chatId: string, userId: string): Promise<boolean>;
    updateChatName(chatId: string, userId: string, name: string): Promise<Chat | null>;
    updateChatPinStatus(chatId: string, userId: string, isPinned: boolean): Promise<Chat | null>;
    addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage>;
    processMessage(chatId: string, userId: string, content: string, images?: Array<{
        url: string;
        mediaType: string;
    }>): Promise<void>;
    clearChatMemory(chatId: string): Promise<void>;
    getStats(): any;
    getChatWithMessages(chatId: string, userId: string): Promise<any>;
    getChatMessages(chatId: string, userId: string, options?: any): Promise<any[]>;
    updateMessage(messageId: string, updates: any): Promise<any>;
    deleteMessage(messageId: string): Promise<boolean>;
    searchMessages(query: string, options?: any): Promise<any[]>;
    updateChat(chatId: string, updates: any): Promise<any>;
    batchDeleteChats(chatIds: string[]): Promise<boolean>;
    batchPinChats(chatIds: string[], pinned: boolean): Promise<boolean>;
    getActiveSessions(userId: string): Promise<any[]>;
    createSession(data: any): Promise<any>;
    getSession(sessionId: string): Promise<any>;
    updateSession(sessionId: string, updates: any): Promise<any>;
    endSession(sessionId: string): Promise<boolean>;
    getSessionStats(sessionId: string): Promise<any>;
    transferSession(sessionId: string, toUserId: string): Promise<any>;
}
export declare const chatService: ChatService;
//# sourceMappingURL=ChatService.d.ts.map