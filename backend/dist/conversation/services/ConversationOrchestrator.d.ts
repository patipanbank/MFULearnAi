import { EventEmitter } from 'events';
import { Conversation, ConversationMessage, CreateConversationRequest, SendMessageRequest } from '../types';
import { ConversationWebSocket } from '../websocket';
export declare class ConversationOrchestrator extends EventEmitter {
    private conversationGraph;
    private webSocketService;
    private activeConversations;
    constructor();
    setWebSocketService(webSocketService: ConversationWebSocket): void;
    private setupEventHandlers;
    private setupWebSocketHandlers;
    createConversation(userId: string, request: CreateConversationRequest): Promise<Conversation>;
    getConversation(conversationId: string, userId: string): Promise<Conversation | null>;
    getConversationMessages(conversationId: string, userId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<ConversationMessage[]>;
    sendMessage(conversationId: string, userId: string, request: SendMessageRequest): Promise<ConversationMessage>;
    private handleWebSocketMessage;
    private processWithWorkflow;
    private handleWorkflowEvent;
    private handleMessageChunk;
    private handleMessageCompleted;
    private handleMessageFailed;
    private handleToolEvent;
    private createMessage;
    private updateMessageContent;
    private updateMessageStatus;
    private addToolCallToMessage;
    private updateToolCallInMessage;
    private broadcastMessage;
    private broadcastStreamingEvent;
    private getMessageContent;
    private getMessageCreatedTime;
    private updateConversationStats;
    private createError;
    getUserConversations(userId: string): Promise<Conversation[]>;
    deleteConversation(conversationId: string, userId: string): Promise<boolean>;
    getStats(): any;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=ConversationOrchestrator.d.ts.map