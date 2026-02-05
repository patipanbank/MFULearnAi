import { redis } from '../config/redis';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../../../../shared/types';

export class HistoryService {
    private static TTL = 86400; // 24 hours

    static async getContext(userId: string, sessionId: string): Promise<{ messages: ChatMessage[], summary: string }> {
        const historyKey = `chat:${userId}:${sessionId}`;

        // 1. Get Summary from DB (Source of Truth for Summary)
        const conversation = await Conversation.findOne({ userId, sessionId }).select('summary');
        const summary = conversation?.summary || '';

        // 2. Get Recent Messages from Redis (Hot Cache)
        const rawHistory = await redis.lrange(historyKey, 0, -1);
        let messages: ChatMessage[] = [];

        if (rawHistory.length > 0) {
            messages = rawHistory
                .map(item => JSON.parse(item))
                .filter(msg => msg.content || msg.images?.length || msg.files?.length);
        } else if (conversation) {
            // Fallback (Cold Start) - Ideally we only load last N messages?
            // Not implemented for brevity, assuming Redis is populated or we load full history
            // REALITY: We should load from DB if Redis empty.
        }

        return { messages, summary };
    }

    // Deprecated: pure getHistory
    static async getHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
        const res = await this.getContext(userId, sessionId);
        return res.messages;
    }

    static async addMessage(userId: string, sessionId: string, message: ChatMessage) {
        const historyKey = `chat:${userId}:${sessionId}`;
        await redis.rpush(historyKey, JSON.stringify(message));
        await redis.expire(historyKey, this.TTL);
        // We assume MongoDB sync happens at the end of the turn or asynchronously
    }

    static async trimHistory(userId: string, sessionId: string, limit: number = 50) {
        const historyKey = `chat:${userId}:${sessionId}`;
        await redis.ltrim(historyKey, -limit, -1);
    }

    static async saveToPersistentStorage(
        userId: string,
        sessionId: string,
        messages: ChatMessage[],
        metadataUpdate: any,
        envType: string,
        modelId: string
    ) {
        await Conversation.findOneAndUpdate(
            { userId, sessionId },
            {
                $push: { messages: { $each: messages } },
                $inc: {
                    'metadata.totalTokens': metadataUpdate.totalTokens || 0,
                    'metadata.messageCount': messages.length
                },
                $set: { modelId, environment: envType, updatedAt: new Date() }
            },
            { upsert: true }
        );
    }

    static async updateSummary(userId: string, sessionId: string, summary: string) {
        await Conversation.updateOne({ userId, sessionId }, { summary });
    }

    static async clearSession(userId: string, sessionId: string) {
        await redis.del(`chat:${userId}:${sessionId}`);
        await Conversation.findOneAndDelete({ userId, sessionId });
    }
}
