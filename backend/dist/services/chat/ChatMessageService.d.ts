import { ChatMessage } from '../../models/chat';
import type { ImageData } from './types/chat-service.types';
export declare class ChatMessageService {
    constructor();
    addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage>;
    updateMessage(chatId: string, messageId: string, updates: Partial<ChatMessage>): Promise<void>;
    getChatMessages(chatId: string): Promise<ChatMessage[]>;
    prepareImagesForMultimodal(images?: Array<{
        url: string;
        mediaType: string;
    }>): Promise<ImageData[]>;
    enrichMessagesWithImages(messages: ChatMessage[]): any[];
}
export declare const chatMessageService: ChatMessageService;
//# sourceMappingURL=ChatMessageService.d.ts.map