import { redis } from '../config/redis';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../../../../shared/types';

export class HistoryService {
    private static TTL = parseInt(process.env.CHAT_CACHE_TTL || '86400', 10); // 24 hours

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
                    tentative_facts: [],
                    intent: {
                        primary: conversation.summary || 'General Inquiry',
                        secondary: [],
                        confidence: 1.0
                    },
                    constraints: [],
                    decisions: [],
                    open_questions: [],
                    confidence_score: 1.0
                },
                version: 1,
                hashes: {},
                lastCanonizedAt: new Date()
            };

            // Migrate back to DB (fire-and-forget)
            this.updateSmartContext(userId, sessionId, smartContext).catch(e => {
                console.error('[HistoryService] Migration persistence failed:', e);
            });
        }

        // 2. Get Recent Messages from Redis (Hot Cache — last 50 only)
        const rawHistory = await redis.lrange(historyKey, -50, -1);
        let messages: ChatMessage[] = [];

        for (const item of rawHistory) {
            try {
                const msg = JSON.parse(item) as ChatMessage;
                if (msg.content || msg.images?.length || msg.files?.length) {
                    messages.push(msg);
                }
            } catch (parseError) {
                // Skip corrupt Redis entries instead of crashing
                console.warn('[HistoryService] Redis parse failed, skipping entry');
            }
        }

        // 3. MongoDB Fallback — if Redis cache expired/empty, pull from cold storage
        if (messages.length === 0) {
            try {
                const conv = await Conversation.findOne(
                    { userId, sessionId, isDeleted: { $ne: true } }
                ).select('messages');
                if (conv?.messages?.length) {
                    const allMsgs = conv.messages as ChatMessage[];
                    messages = allMsgs
                        .filter(msg => msg.content || (msg as any).images?.length || (msg as any).files?.length)
                        .slice(-50);

                    // Rehydrate Redis cache so subsequent reads are fast
                    await this.rehydrateRedisCache(historyKey, messages);
                    console.log(`[HistoryService] Rehydrated ${messages.length} messages from MongoDB for session ${sessionId}`);
                }
            } catch (err) {
                console.error('[HistoryService] MongoDB fallback failed:', err);
                // Return empty — better than crashing
            }
        }

        return { messages, smartContext };
    }

    /**
     * Rehydrate Redis cache from MongoDB cold storage.
     * Uses pipeline for atomic batch write.
     */
    private static async rehydrateRedisCache(key: string, messages: ChatMessage[]) {
        if (messages.length === 0) return;
        const pipeline = redis.pipeline();
        pipeline.del(key);
        for (const msg of messages) {
            pipeline.rpush(key, JSON.stringify(msg));
        }
        pipeline.expire(key, this.TTL);
        await pipeline.exec();
    }

    // Deprecated: pure getHistory
    static async getHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
        const res = await this.getContext(userId, sessionId);
        return res.messages;
    }

    static async addMessage(userId: string, sessionId: string, message: ChatMessage) {
        try {
            const historyKey = `chat:${userId}:${sessionId}`;
            await redis.rpush(historyKey, JSON.stringify(message));
            await redis.expire(historyKey, this.TTL);
        } catch (e) {
            console.warn('[HistoryService] redis addMessage failed:', e);
        }
    }

    static async trimHistory(userId: string, sessionId: string, limit: number = 50) {
        try {
            const historyKey = `chat:${userId}:${sessionId}`;
            await redis.ltrim(historyKey, -limit, -1);
        } catch (e) {
            console.warn('[HistoryService] redis trim failed:', e);
        }
    }

    /**
     * Ensures a conversation record exists in MongoDB.
     * Prevents lost sessions if the workflow is interrupted.
     */
    static async ensureSessionExists(userId: string, sessionId: string, initialTitle: string, modelId?: string) {
        try {
            await Conversation.findOneAndUpdate(
                { userId, sessionId },
                {
                    $setOnInsert: {
                        userId,
                        sessionId,
                        'metadata.title': initialTitle,
                        modelId: modelId || 'default',
                        messages: [],
                        isDeleted: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );
        } catch (error: any) {
            console.error('[HistoryService] ensureSessionExists failed:', error.message);
        }
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
                updatedAt: new Date()
            }
        );
    }

    static async updateSummary(userId: string, sessionId: string, summary: string) {
        // Legacy support
        await Conversation.updateOne({ userId, sessionId }, { summary });
    }

    /**
     * Soft-delete: clears Redis and marks MongoDB document as deleted.
     * Matches backend behavior (previously was hard delete).
     */
    static async clearSession(userId: string, sessionId: string) {
        await redis.del(`chat:${userId}:${sessionId}`);
        await Conversation.updateOne(
            { userId, sessionId },
            { $set: { deletedAt: new Date(), isDeleted: true, updatedAt: new Date() } }
        );
    }
}
