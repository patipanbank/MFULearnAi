import { redis } from '../config/redis';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../../../../shared/types';

export class HistoryService {
    private static TTL = 86400; // 24 hours

    static async getContext(userId: string, sessionId: string): Promise<{ messages: ChatMessage[], smartContext: any }> {
        const historyKey = `chat:${userId}:${sessionId}`;

        // 1. Get Smart Context from DB
        const conversation = await Conversation.findOne({ userId, sessionId }).select('smartContext summary');

        let smartContext = conversation?.smartContext;

        // Migration Fallback: If no smartContext but summary exists, initialize it
        if (!smartContext && conversation?.summary) {
            smartContext = {
                canonical: '',
                rolling: {
                    facts: [],
                    intent: conversation.summary, // Use legacy summary as initial intent/context
                    constraints: [],
                    decisions: [],
                    open_questions: []
                },
                version: 1,
                hashes: {},
                lastCanonizedAt: new Date()
            };
        }

        // 2. Get Recent Messages from Redis (Hot Cache — last 50 only)
        const rawHistory = await redis.lrange(historyKey, -50, -1);
        let messages: ChatMessage[] = [];

        if (rawHistory.length > 0) {
            messages = rawHistory
                .map(item => JSON.parse(item))
                .filter(msg => msg.content || msg.images?.length || msg.files?.length);
        }

        return { messages, smartContext };
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

    static async updateSmartContext(userId: string, sessionId: string, smartContext: any) {
        await Conversation.updateOne(
            { userId, sessionId },
            {
                smartContext,
                // Also update legacy summary for backward compatibility if needed?
                // summary: smartContext.rolling.intent 
            }
        );
    }

    static async updateSummary(userId: string, sessionId: string, summary: string) {
        // Legacy support
        await Conversation.updateOne({ userId, sessionId }, { summary });
    }

    static async clearSession(userId: string, sessionId: string) {
        await redis.del(`chat:${userId}:${sessionId}`);
        await Conversation.findOneAndDelete({ userId, sessionId });
    }
}
