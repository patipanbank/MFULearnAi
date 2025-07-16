import { Model } from 'mongoose';
import { Chat, ChatDocument } from '../models/chat.model';
import { ChatMessage } from '../models/chat.model';
export declare class ChatHistoryService {
    private chatModel;
    constructor(chatModel: Model<ChatDocument>);
    getChatHistoryForUser(userId: string): Promise<Chat[]>;
    getChatById(chatId: string): Promise<Chat | null>;
    createChat(userId: string, name: string, agentId?: string, modelId?: string): Promise<Chat>;
    addMessageToChat(chatId: string, message: ChatMessage): Promise<Chat | null>;
    deleteChat(chatId: string): Promise<boolean>;
    updateChatName(chatId: string, name: string): Promise<Chat | null>;
    updateChatPinStatus(chatId: string, isPinned: boolean): Promise<Chat | null>;
}
