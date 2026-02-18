import { redis } from '../config/redis';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../../../shared/types';

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
                    intent: {
                        primary: conversation.summary || 'General Inquiry',
                        secondary: [],
                        confidence: 1.0
                    },
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
                .filter(msg => msg.content || msg.images?.length || msg.files?.length || msg.attachments?.length);
        }

        return { messages, smartContext };
    }

    // Supports Pagination: Redis (Hot) -> MongoDB (Cold)
    static async getHistoryWithPagination(userId: string, sessionId: string, limit: number = 20, beforeTimestamp?: string): Promise<ChatMessage[]> {
        // Case 1: Initial Load (No cursor) -> Try Redis First
        if (!beforeTimestamp) {
            const { messages } = await this.getContext(userId, sessionId);
            if (messages.length > 0) return messages;
        }

        // Case 2: Load Older (Cursor exists) OR Redis Miss -> Query MongoDB
        const query: any = { userId, sessionId };

        // Use aggregation to slice the messages array effectively
        // Since messages are embedded, we must unwind/filter/sort/group or use $slice with $filter
        // BUT 'messages' in Mongo is an array sorted by insertion (usually chronological).
        // Pagination on embedded arrays is tricky.

        // Simpler approach for embedded array:
        // Fetch the conversation, but use projection/filtering if possible.
        // Mongoose doesn't support $elemMatch with sort/limit easily on embedded arrays without aggregation.

        const conversation = await Conversation.findOne(query).select('messages');
        if (!conversation || !conversation.messages) return [];

        let allMessages = conversation.messages as unknown as ChatMessage[];

        // Sort descending (newest first) to paginate backwards
        allMessages.sort((a, b) => {
            const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tB - tA;
        });

        if (beforeTimestamp) {
            const beforeTime = new Date(beforeTimestamp).getTime();
            allMessages = allMessages.filter(m => {
                const t = m.timestamp ? new Date(m.timestamp).getTime() : 0;
                return t < beforeTime;
            });
        }

        // Take limit
        const sliced = allMessages.slice(0, limit);

        // Return ascending for frontend display
        return sliced.reverse();
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
