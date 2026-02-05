import { redis } from '../config/redis';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../../../../shared/types';

export class HistoryService {
    private static TTL = 86400; // 24 hours

    static async getHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
        const historyKey = `chat:${userId}:${sessionId}`;

        // 1. Try Redis
        const rawHistory = await redis.lrange(historyKey, 0, -1);
        if (rawHistory.length > 0) {
            return rawHistory
                .map(item => JSON.parse(item))
                .filter(msg => msg.content || msg.images?.length || msg.files?.length);
        }

        // 2. Fallback to MongoDB
        const conversation = await Conversation.findOne({ userId, sessionId });
        if (conversation) {
            // Repopulate Redis
            for (const msg of conversation.messages) {
                await redis.rpush(historyKey, JSON.stringify(msg));
            }
            await redis.expire(historyKey, this.TTL);
            return conversation.messages as ChatMessage[];
        }

        return [];
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

    static async clearSession(userId: string, sessionId: string) {
        await redis.del(`chat:${userId}:${sessionId}`);
        await Conversation.findOneAndDelete({ userId, sessionId });
    }
}
