export declare class ChatService {
    private agentInstances;
    private chainInstances;
    constructor();
    createChat(userId: string, agentId: string, name?: string): Promise<ChatModel>;
    getChat(chatId: string): Promise<ChatModel | null>;
    getUserChats(userId: string): Promise<ChatModel[]>;
    updateChatName(chatId: string, name: string): Promise<boolean>;
    updateChatPinStatus(chatId: string, isPinned: boolean): Promise<boolean>;
    deleteChat(chatId: string): Promise<boolean>;
    clearChatMemory(chatId: string): Promise<boolean>;
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