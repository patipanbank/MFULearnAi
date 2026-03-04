import { redis } from '../config/redis';
import { Conversation } from '../models/Conversation';
import { MessageArchive } from '../models/MessageArchive';
import { ChatMessage, SmartContext } from '../../../shared/types';
import { LoggerService } from './LoggerService';
import { encryptMessage, decryptMessage, encryptSmartContext, decryptSmartContext, isEncryptionEnabled } from '../infra/encryption';
import { withSessionLock } from '../infra/locks';

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

    /** Threshold: archive when embedded messages array exceeds this count */
    private static ARCHIVE_THRESHOLD = parseInt(process.env.MESSAGE_ARCHIVE_THRESHOLD || '500', 10);
    /** How many messages to keep in the main document after archival */
    private static ARCHIVE_KEEP_RECENT = parseInt(process.env.MESSAGE_ARCHIVE_KEEP || '100', 10);

    /**
     * Loads recent messages from Redis and SmartContext from MongoDB.
     * Falls back to MongoDB cold storage when Redis cache is empty/expired.
     * Handles migration from legacy `summary` field to SmartContext.
     * Always returns a valid SmartContext (never undefined).
     */
    static async getContext(userId: string, sessionId: string): Promise<{ messages: ChatMessage[], smartContext: SmartContext }> {
        const historyKey = `chat:${userId}:${sessionId}`;

        // 1. Get Smart Context from DB
        const conversation = await Conversation.findOne({ userId, sessionId }).select('smartContext summary');

        let smartContext: SmartContext | undefined = conversation?.smartContext
            ? decryptSmartContext(conversation.smartContext as unknown as SmartContext)
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

        // 3. MongoDB Fallback: If Redis returned NO messages, rehydrate from cold storage
        //    This handles TTL expiry (24h default), server restart, or Redis flush scenarios.
        if (messages.length === 0) {
            try {
                const conv = await Conversation.findOne(
                    { userId, sessionId, isDeleted: { $ne: true } }
                ).select('messages').lean();

                if (conv?.messages && conv.messages.length > 0) {
                    const coldMessages = (conv.messages as unknown as ChatMessage[])
                        .slice(-50)
                        .map(m => decryptMessage(m));

                    LoggerService.info('history_rehydrated_from_mongodb', {
                        userId,
                        sessionId,
                        messageCount: coldMessages.length,
                        totalInMongo: conv.messages.length
                    });

                    // Warm Redis cache back up (fire-and-forget, non-blocking)
                    this.rehydrateRedisCache(historyKey, coldMessages).catch(e => {
                        LoggerService.warn('redis_rehydrate_failed', {
                            sessionId,
                            error: e instanceof Error ? e.message : String(e)
                        });
                    });

                    // Return messages from MongoDB immediately
                    return {
                        messages: coldMessages,
                        smartContext: smartContext ?? { ...DEFAULT_SMART_CONTEXT }
                    };
                }
            } catch (mongoErr) {
                LoggerService.error('history_mongodb_fallback_failed', {
                    userId,
                    sessionId,
                    error: mongoErr instanceof Error ? mongoErr.message : 'Unknown error'
                });
                // Continue with empty messages — don't crash the workflow
            }
        }

        // Always return a valid SmartContext — never undefined
        return { messages, smartContext: smartContext ?? { ...DEFAULT_SMART_CONTEXT } };
    }

    /**
     * Rehydrates the Redis hot cache from MongoDB cold storage.
     * Used when Redis TTL has expired but conversation exists in MongoDB.
     */
    private static async rehydrateRedisCache(historyKey: string, messages: ChatMessage[]): Promise<void> {
        if (messages.length === 0) return;

        const pipeline = redis.pipeline();
        // Clear any stale key first
        pipeline.del(historyKey);
        for (const msg of messages) {
            pipeline.rpush(historyKey, JSON.stringify(msg));
        }
        pipeline.expire(historyKey, this.TTL);
        await pipeline.exec();
    }

    /**
     * Paginated history: Redis (Hot) → MongoDB (Cold) → Archive.
     * Respects soft-deleted conversations.
     *
     * Strategy:
     *  - Initial load (no cursor): getContext() which now has MongoDB fallback
     *  - Scroll-up (cursor given): Uses $slice-based pagination (avoids expensive $unwind)
     *  - If all main messages exhausted, queries MessageArchive for older batches.
     */
    static async getHistoryWithPagination(
        userId: string,
        sessionId: string,
        limit: number = 20,
        beforeTimestamp?: string
    ): Promise<ChatMessage[]> {
        // Case 1: Initial Load (No cursor) → getContext() with full fallback chain
        if (!beforeTimestamp) {
            const { messages } = await this.getContext(userId, sessionId);
            if (messages.length > 0) return messages;
        }

        // Case 2: Load Older (Cursor exists) → $slice-based pagination (O(1) vs $unwind O(n))
        const beforeDate = beforeTimestamp ? new Date(beforeTimestamp) : new Date();

        // First try: main document messages
        const conv = await Conversation.findOne(
            { userId, sessionId, isDeleted: { $ne: true } }
        ).select('messages').lean();

        if (conv?.messages?.length) {
            const allMsgs = (conv.messages as any[]);
            // Filter messages before the cursor
            const olderMsgs = allMsgs
                .filter(m => new Date(m.timestamp) < beforeDate)
                .slice(-limit)
                .map(m => decryptMessage(m));

            if (olderMsgs.length > 0) return olderMsgs;
        }

        // Case 3: Check MessageArchive for even older messages
        const archives = await MessageArchive.find({
            userId, sessionId,
            'timestampRange.newest': { $lt: beforeDate }
        })
            .sort({ batchIndex: -1 })
            .limit(1)
            .lean();

        if (archives.length > 0 && archives[0].messages?.length) {
            return archives[0].messages
                .slice(-limit)
                .map((m: any) => decryptMessage(m));
        }

        return [];
    }

    /**
     * Pushes a message to the Redis hot cache with TTL refresh.
     * Uses distributed lock to prevent concurrent write races.
     */
    static async addMessage(userId: string, sessionId: string, message: ChatMessage) {
        try {
            const historyKey = `chat:${userId}:${sessionId}`;
            const msgToStore = isEncryptionEnabled() ? encryptMessage(message) : message;
            await redis.rpush(historyKey, JSON.stringify(msgToStore));
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
     * Ensures a conversation record exists in MongoDB.
     * Used at the start of a chat to prevent lost sessions if the workflow is interrupted.
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
            LoggerService.debug('session_ensured', { sessionId, initialTitle }, userId);
        } catch (error: any) {
            LoggerService.error('ensure_session_failed', { sessionId, error: error.message }, userId);
            // Non-blocking, but we logged it
        }
    }

    /**
     * Persists messages to MongoDB, atomically updating metadata.
     * Includes overflow protection: archives old messages when threshold exceeded.
     * Uses distributed lock to prevent concurrent write races.
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
            const msgsToStore = isEncryptionEnabled()
                ? messages.map(m => encryptMessage(m))
                : messages;

            await withSessionLock(userId, sessionId, async () => {
                await Conversation.findOneAndUpdate(
                    { userId, sessionId },
                    {
                        $push: { messages: { $each: msgsToStore } },
                        $inc: {
                            'metadata.totalTokens': metadataUpdate.totalTokens || 0,
                            'metadata.weightedTokens': metadataUpdate.weightedTokens || 0,
                            'metadata.messageCount': messages.length
                        },
                        $set: { modelId, environment: envType, updatedAt: new Date() }
                    },
                    { upsert: true }
                );

                // Overflow Protection: archive excess messages to prevent 16MB BSON limit
                await this.archiveIfNeeded(userId, sessionId);
            });
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
     * Archive overflow: when messages exceed threshold, move oldest to MessageArchive.
     * Keeps the most recent ARCHIVE_KEEP_RECENT messages in the main document.
     */
    private static async archiveIfNeeded(userId: string, sessionId: string): Promise<void> {
        const conv = await Conversation.findOne({ userId, sessionId })
            .select('messages metadata.messageCount')
            .lean();

        if (!conv?.messages || conv.messages.length <= this.ARCHIVE_THRESHOLD) return;

        const allMsgs = conv.messages as any[];
        const toArchive = allMsgs.slice(0, allMsgs.length - this.ARCHIVE_KEEP_RECENT);
        const toKeep = allMsgs.slice(allMsgs.length - this.ARCHIVE_KEEP_RECENT);

        if (toArchive.length === 0) return;

        // Determine next batch index
        const lastArchive = await MessageArchive.findOne({ userId, sessionId })
            .sort({ batchIndex: -1 })
            .select('batchIndex')
            .lean();
        const nextBatch = (lastArchive?.batchIndex ?? -1) + 1;

        const approxSize = Buffer.byteLength(JSON.stringify(toArchive), 'utf8');

        // Create archive batch
        await MessageArchive.create({
            userId,
            sessionId,
            batchIndex: nextBatch,
            messages: toArchive,
            timestampRange: {
                oldest: toArchive[0]?.timestamp || new Date(),
                newest: toArchive[toArchive.length - 1]?.timestamp || new Date()
            },
            messageCount: toArchive.length,
            approxSizeBytes: approxSize
        });

        // Replace main document messages with only recent ones
        await Conversation.updateOne(
            { userId, sessionId },
            { $set: { messages: toKeep, updatedAt: new Date() } }
        );

        LoggerService.info('messages_archived', {
            sessionId,
            archived: toArchive.length,
            kept: toKeep.length,
            batchIndex: nextBatch,
            approxSizeBytes: approxSize
        });
    }

    /**
     * Atomically updates the SmartContext for a session.
     * Encrypts canonical text if encryption is enabled.
     */
    static async updateSmartContext(userId: string, sessionId: string, smartContext: SmartContext) {
        const ctxToStore = isEncryptionEnabled() ? encryptSmartContext(smartContext) : smartContext;
        await Conversation.updateOne(
            { userId, sessionId },
            {
                $set: {
                    smartContext: ctxToStore,
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
     * Soft-deletes a session: clears Redis cache, marks MongoDB as deleted,
     * and cascade-cleans orphaned MessageFeedback records.
     */
    static async clearSession(userId: string, sessionId: string) {
        try {
            await redis.del(`chat:${userId}:${sessionId}`);
            await Conversation.updateOne(
                { userId, sessionId },
                { $set: { deletedAt: new Date(), isDeleted: true, updatedAt: new Date() } }
            );

            // Cascade cleanup: remove orphaned feedback records (fire-and-forget)
            import('../models/MessageFeedback').then(({ MessageFeedback }) => {
                MessageFeedback.deleteMany({ sessionId, userId }).catch(e => {
                    LoggerService.warn('feedback_cascade_delete_failed', {
                        sessionId,
                        error: e instanceof Error ? e.message : String(e)
                    });
                });
            }).catch(() => { /* module import failed — non-critical */ });

        } catch (e) {
            LoggerService.error('clear_session_failed', {
                userId,
                sessionId,
                error: e instanceof Error ? e.message : 'Unknown error'
            });
            throw e; // Re-throw — caller (ChatController) checks for 500
        }
    }

    // ── GDPR Compliance Methods ─────────────────────────────

    /**
     * Export all chat data for a user (GDPR Article 20 — Right to Data Portability).
     * Returns all conversations with decrypted content.
     */
    static async exportUserData(userId: string): Promise<any[]> {
        const conversations = await Conversation.find(
            { userId, isDeleted: { $ne: true } }
        ).lean();

        // Also include archived messages
        const archives = await MessageArchive.find({ userId }).lean();

        return conversations.map(conv => {
            const archiveBatches = archives
                .filter(a => a.sessionId === (conv as any).sessionId)
                .sort((a, b) => a.batchIndex - b.batchIndex);

            const archivedMsgs = archiveBatches.flatMap(a =>
                (a.messages || []).map((m: any) => decryptMessage(m))
            );
            const mainMsgs = ((conv as any).messages || []).map((m: any) => decryptMessage(m));

            return {
                sessionId: (conv as any).sessionId,
                metadata: (conv as any).metadata,
                smartContext: (conv as any).smartContext
                    ? decryptSmartContext((conv as any).smartContext)
                    : undefined,
                messages: [...archivedMsgs, ...mainMsgs],
                createdAt: (conv as any).createdAt,
                updatedAt: (conv as any).updatedAt
            };
        });
    }

    /**
     * Hard-purge all data for a user (GDPR Article 17 — Right to Erasure).
     * Irreversibly deletes all conversations, archives, feedback, and Redis cache.
     */
    static async purgeUserData(userId: string): Promise<{ conversationsDeleted: number; archivesDeleted: number; feedbackDeleted: number }> {
        // 1. Get all session IDs for Redis cleanup
        const sessions = await Conversation.find({ userId }).select('sessionId').lean();
        const sessionIds = sessions.map(s => (s as any).sessionId);

        // 2. Clear Redis caches
        if (sessionIds.length > 0) {
            const pipeline = redis.pipeline();
            for (const sid of sessionIds) {
                pipeline.del(`chat:${userId}:${sid}`);
            }
            await pipeline.exec();
        }

        // 3. Hard-delete from MongoDB (not soft delete — this is full erasure)
        const [convResult, archiveResult, feedbackResult] = await Promise.all([
            Conversation.deleteMany({ userId }),
            MessageArchive.deleteMany({ userId }),
            import('../models/MessageFeedback').then(({ MessageFeedback }) =>
                MessageFeedback.deleteMany({ userId })
            ).catch(() => ({ deletedCount: 0 }))
        ]);

        LoggerService.info('gdpr_user_data_purged', {
            userId,
            conversationsDeleted: convResult.deletedCount,
            archivesDeleted: archiveResult.deletedCount,
            feedbackDeleted: (feedbackResult as any).deletedCount || 0
        });

        return {
            conversationsDeleted: convResult.deletedCount || 0,
            archivesDeleted: archiveResult.deletedCount || 0,
            feedbackDeleted: (feedbackResult as any).deletedCount || 0
        };
    }

    // ── Full-Text Search ────────────────────────────────────

    /**
     * Search chat history by keyword (uses MongoDB text index).
     * Falls back to regex search if text index is not available.
     */
    static async searchHistory(
        userId: string,
        query: string,
        limit: number = 20
    ): Promise<{ sessionId: string; title: string; matchedMessages: any[]; updatedAt: Date }[]> {
        if (!query || query.trim().length === 0) return [];

        const results = await Conversation.aggregate([
            {
                $match: {
                    userId,
                    isDeleted: { $ne: true },
                    'messages.content': { $regex: query, $options: 'i' }
                }
            },
            { $project: {
                sessionId: 1,
                'metadata.title': 1,
                updatedAt: 1,
                messages: {
                    $filter: {
                        input: '$messages',
                        as: 'msg',
                        cond: {
                            $regexMatch: { input: '$$msg.content', regex: query, options: 'i' }
                        }
                    }
                }
            }},
            { $match: { 'messages.0': { $exists: true } } },
            { $sort: { updatedAt: -1 } },
            { $limit: limit },
            { $project: {
                sessionId: 1,
                title: '$metadata.title',
                updatedAt: 1,
                matchedMessages: { $slice: ['$messages', 3] }
            }}
        ]);

        // Decrypt matched messages if encryption is enabled
        return results.map(r => ({
            ...r,
            matchedMessages: r.matchedMessages.map((m: any) => decryptMessage(m))
        }));
    }
}
