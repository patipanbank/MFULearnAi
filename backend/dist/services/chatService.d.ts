import { IChat } from '../models/chat';
export declare class ChatService {
    private agentInstances;
    private chainInstances;
    constructor();
    createChat(userId: string, name: string, agentId?: string, initialMessage?: string): Promise<IChat>;
    getChat(chatId: string): Promise<IChat | null>;
    getChatsByUser(userId: string): Promise<IChat[]>;
    updateChatName(chatId: string, name: string): Promise<IChat | null>;
    updateChatPinStatus(chatId: string, isPinned: boolean): Promise<boolean>;
    deleteChat(chatId: string): Promise<boolean>;
    clearChatMemory(chatId: string): Promise<boolean>;
    getChatMessages(chatId: string, page?: number, limit?: number): Promise<any[]>;
    clearChatMessages(chatId: string): Promise<boolean>;
    processMessage(chatId: string, userId: string, message: string, images?: Array<{
        url: string;
        mediaType: string;
    }>): Promise<void>;
    private processWithLangChainAgent;
    private processWithChain;
    private convertToLangChainMessages;
    private normalizeChat;
}
export declare const chatService: ChatService;
//# sourceMappingURL=chatService.d.ts.map