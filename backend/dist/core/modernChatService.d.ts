import { Chat, ChatMessage } from '../models/chat';
export declare class ModernChatService {
    constructor();
    createChat(userId: string, name: string, agentId?: string): Promise<Chat>;
    getChat(chatId: string, userId: string): Promise<Chat | null>;
    addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage>;
    processMessage(chatId: string, userId: string, content: string, images?: Array<{
        url: string;
        mediaType: string;
    }>): Promise<void>;
    private processWithIntentRoutedAgent;
    private buildRoutedAgentConfig;
    private buildIntentAwareSystemPrompt;
    private getDefaultSystemPromptForIntent;
    private executeAdvancedReasoningAgent;
    private executeSimplifiedModernAgent;
    private processWithModernAgent;
    private createAdvancedAgentEventHandler;
    private createSimplifiedAgentEventHandler;
    private updateMessageContent;
    private updateMessageThinking;
    private updateMessageFinalAnswer;
    private broadcastToChat;
    getUserChats(userId: string): Promise<Chat[]>;
    deleteChat(chatId: string, userId: string): Promise<boolean>;
    updateChatName(chatId: string, userId: string, name: string): Promise<boolean>;
}
export declare const modernChatService: ModernChatService;
//# sourceMappingURL=modernChatService.d.ts.map