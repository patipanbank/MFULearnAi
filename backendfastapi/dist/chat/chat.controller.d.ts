import { ChatService } from './chat.service';
import { ChatHistoryService } from './chat-history.service';
export declare class ChatController {
    private chatService;
    private chatHistoryService;
    constructor(chatService: ChatService, chatHistoryService: ChatHistoryService);
    getChatHistory(req: any): Promise<any>;
    getChatById(chatId: string, req: any): Promise<any>;
    createChat(createChatDto: any, req: any): Promise<any>;
    updateChatName(chatId: string, body: {
        name: string;
    }, req: any): Promise<any>;
    updateChatPinStatus(chatId: string, body: {
        isPinned: boolean;
    }, req: any): Promise<any>;
    deleteChat(chatId: string, req: any): Promise<any>;
    clearChatMemory(chatId: string, req: any): Promise<any>;
    getUserChatStats(req: any): Promise<any>;
    getMemoryStats(): Promise<any>;
}
