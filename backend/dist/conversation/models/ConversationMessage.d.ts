import mongoose, { Document } from 'mongoose';
import { MessageRole, MessageStatus, MessageAttachment, ToolCall, TokenUsage, ErrorDetails } from '../types';
export interface ConversationMessageDocument extends Document {
    updateStatus(status: MessageStatus, error?: ErrorDetails): void;
    addToolCall(toolCall: Omit<ToolCall, 'id'>): string;
    updateToolCall(toolCallId: string, updates: Partial<ToolCall>): boolean;
    addAttachment(attachment: MessageAttachment): void;
    updateTokenUsage(tokenUsage: TokenUsage): void;
    retry(): void;
}
export interface ConversationMessageModel extends mongoose.Model<ConversationMessageDocument> {
    findByConversationId(conversationId: string, options?: {
        limit?: number;
        skip?: number;
        role?: MessageRole;
        status?: MessageStatus;
        includeToolCalls?: boolean;
    }): Promise<ConversationMessageDocument[]>;
    findLatestByConversation(conversationId: string, limit?: number): Promise<ConversationMessageDocument[]>;
    findStreamingMessages(): Promise<ConversationMessageDocument[]>;
    findFailedMessages(retryable?: boolean, maxRetries?: number): Promise<ConversationMessageDocument[]>;
    getMessageStats(conversationId: string): Promise<any[]>;
    searchContent(conversationId: string, searchQuery: string): Promise<ConversationMessageDocument[]>;
}
export declare const ConversationMessageModel: ConversationMessageModel;
//# sourceMappingURL=ConversationMessage.d.ts.map