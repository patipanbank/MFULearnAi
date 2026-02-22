import { redis } from '../config/redis';
import { Conversation } from '../models/Conversation';
import { ChatMessage, SmartContext } from '../../../shared/types';
import { LoggerService } from './LoggerService';

/** Default SmartContext for brand-new or un-migrated sessions */
const DEFAULT_SMART_CONTEXT: SmartContext = {
    canonical: '',
    rolling: {
        facts: [],
        tentative_facts: [],
        intent: {
            primary: 'General Inquiry',
            secondary: [],
            confidence: 1.0
        },
        constraints: [],
        decisions: [],
        open_questions: [],
        confidence_score: 1.0
    },
    version: 0,
    hashes: { canonical: '', rolling: '', raw: '' },
    lastCanonizedAt: new Date()
};

export class HistoryService {
    private static TTL = parseInt(process.env.CHAT_CACHE_TTL || '86400', 10); // Default 24 hours

    /**
     * Loads recent messages from Redis and SmartContext from MongoDB.
     * Handles migration from legacy `summary` field to SmartContext.
     * Always returns a valid SmartContext (never undefined).
     */
    static async getContext(userId: string, sessionId: string): Promise<{ messages: ChatMessage[], smartContext: SmartContext }> {
        const historyKey = `chat:${userId}:${sessionId}`;

        // 1. Get Smart Context from DB
        const conversation = await Conversation.findOne({ userId, sessionId }).select('smartContext summary');

        let smartContext: SmartContext | undefined = conversation?.smartContext
            ? (conversation.smartContext as unknown as SmartContext)
            : undefined;

        // Migration Fallback: If no smartContext but summary exists, initialize it
        if (!smartContext && conversation?.summary) {
            smartContext = {
                ...DEFAULT_SMART_CONTEXT,
                rolling: {
                    ...DEFAULT_SMART_CONTEXT.rolling,
                    intent: {
                        primary: conversation.summary || 'General Inquiry',
                        secondary: [],
                        confidence: 1.0
                    }
                },
                version: 1,
                lastCanonizedAt: new Date()
            };

            // Migrate back to DB (fire-and-forget)
            this.updateSmartContext(userId, sessionId, smartContext).catch(e => {
                LoggerService.error('Migration persistence failed', e);
            });
        }

        // 2. Get Recent Messages from Redis (Hot Cache — last 50 only)
        const rawHistory = await redis.lrange(historyKey, -50, -1);
        const messages: ChatMessage[] = [];

        for (const item of rawHistory) {
            try {
                const msg = JSON.parse(item) as ChatMessage;
                if (msg.content || msg.images?.length || msg.files?.length || msg.attachments?.length) {
                    messages.push(msg);
                }
            } catch (parseError) {
                // Skip corrupt Redis entries instead of crashing entire context retrieval
                LoggerService.warn('redis_parse_failed', {
                    userId,
                    sessionId,
                    error: parseError instanceof Error ? parseError.message : 'JSON parse error'
                });
            }
        }

        // Always return a valid SmartContext — never undefined
        return { messages, smartContext: smartContext ?? { ...DEFAULT_SMART_CONTEXT } };
    }

    /**
     * Paginated history: Redis (Hot) → MongoDB (Cold).
     * Respects soft-deleted conversations.
     */
    static async getHistoryWithPagination(
        userId: string,
        sessionId: string,
        limit: number = 20,
        beforeTimestamp?: string
    ): Promise<ChatMessage[]> {
        // Case 1: Initial Load (No cursor) → Try Redis First
        if (!beforeTimestamp) {
            const { messages } = await this.getContext(userId, sessionId);
            if (messages.length > 0) return messages;
        }

        // Case 2: Load Older (Cursor exists) OR Redis Miss → Query MongoDB
        // Use MongoDB aggregation framework instead of loading entire message history to memory
        const timestampFilter = beforeTimestamp
            ? { 'messages.timestamp': { $lt: new Date(beforeTimestamp) } }
            : {};

        const result = await Conversation.aggregate([
            { $match: { userId, sessionId, isDeleted: { $ne: true } } },
            { $unwind: '$messages' },
            { $match: timestampFilter },
            { $sort: { 'messages.timestamp': -1 } },
            { $limit: limit },
            { $group: { _id: '$_id', messages: { $push: '$messages' } } }
        ]);

        if (!result || result.length === 0) return [];

        const fetchedMessages = result[0].messages as ChatMessage[];

        // Ensure fetchedMessages is returned ascending for frontend display
        return fetchedMessages.reverse();
    }

    /**
     * Pushes a message to the Redis hot cache with TTL refresh.
     */
    static async addMessage(userId: string, sessionId: string, message: ChatMessage) {
        try {
            const historyKey = `chat:${userId}:${sessionId}`;
            await redis.rpush(historyKey, JSON.stringify(message));
            await redis.expire(historyKey, this.TTL);
        } catch (e) {
            LoggerService.warn('redis_add_message_failed', {
                userId,
                sessionId,
                error: e instanceof Error ? e.message : 'Unknown error'
            });
        }
    }

    /**
     * Trims the Redis list to keep only the last N messages.
     */
    static async trimHistory(userId: string, sessionId: string, limit: number = 50) {
        try {
            const historyKey = `chat:${userId}:${sessionId}`;
            await redis.ltrim(historyKey, -limit, -1);
        } catch (e) {
            LoggerService.warn('redis_trim_failed', {
                userId,
                sessionId,
                error: e instanceof Error ? e.message : 'Unknown error'
            });
        }
    }

    /**
     * Persists messages to MongoDB, atomically updating metadata.
     */
    static async saveToPersistentStorage(
        userId: string,
        sessionId: string,
        messages: ChatMessage[],
        metadataUpdate: { totalTokens?: number; weightedTokens?: number },
        envType: string,
        modelId: string
    ) {
        try {
            await Conversation.findOneAndUpdate(
                { userId, sessionId },
                {
                    $push: { messages: { $each: messages } },
                    $inc: {
                        'metadata.totalTokens': metadataUpdate.totalTokens || 0,
                        'metadata.weightedTokens': metadataUpdate.weightedTokens || 0,
                        'metadata.messageCount': messages.length
                    },
                    $set: { modelId, environment: envType, updatedAt: new Date() }
                },
                { upsert: true }
            );
        } catch (e) {
            LoggerService.error('persistent_storage_save_failed', {
                userId,
                sessionId,
                messageCount: messages.length,
                error: e instanceof Error ? e.message : 'Unknown error'
            });
            throw e; // Re-throw — caller (ResultPersister) needs to know persistence failed
        }
    }

    /**
     * Atomically updates the SmartContext for a session.
     */
    static async updateSmartContext(userId: string, sessionId: string, smartContext: SmartContext) {
        await Conversation.updateOne(
            { userId, sessionId },
            {
                $set: {
                    smartContext,
                    updatedAt: new Date()
                }
            }
        );
    }

    /**
     * @deprecated Legacy support only — prefer SmartContext updates.
     */
    static async updateSummary(userId: string, sessionId: string, summary: string) {
        await Conversation.updateOne(
            { userId, sessionId },
            { $set: { summary, updatedAt: new Date() } }
        );
    }

    /**
     * Soft-deletes a session: clears Redis cache and marks the MongoDB document as deleted.
     */
    static async clearSession(userId: string, sessionId: string) {
        try {
            await redis.del(`chat:${userId}:${sessionId}`);
            await Conversation.updateOne(
                { userId, sessionId },
                { $set: { deletedAt: new Date(), isDeleted: true, updatedAt: new Date() } }
            );
        } catch (e) {
            LoggerService.error('clear_session_failed', {
                userId,
                sessionId,
                error: e instanceof Error ? e.message : 'Unknown error'
            });
            throw e; // Re-throw — caller (ChatController) checks for 500
        }
    }
}
