import mongoose, { Document } from 'mongoose';
import { ConversationStatus } from '../types';
export interface ConversationDocument extends Document {
    updateStats(stats: {
        messageCount?: number;
        tokenUsage?: number;
        responseTime?: number;
        errorOccurred?: boolean;
    }): void;
    setError(error: {
        code: string;
        message: string;
        details?: any;
        retryable?: boolean;
    }): void;
    clearError(): void;
    archive(): void;
    pin(): void;
    unpin(): void;
}
export interface ConversationModel extends mongoose.Model<ConversationDocument> {
    findByUserId(userId: string, options?: {
        status?: ConversationStatus;
        isPinned?: boolean;
        limit?: number;
        skip?: number;
    }): Promise<ConversationDocument[]>;
    findActiveByUser(userId: string): Promise<ConversationDocument[]>;
    searchConversations(userId: string, searchQuery: string): Promise<ConversationDocument[]>;
    getStatsByUser(userId: string): Promise<any[]>;
}
export declare const ConversationModel: ConversationModel;
//# sourceMappingURL=Conversation.d.ts.map