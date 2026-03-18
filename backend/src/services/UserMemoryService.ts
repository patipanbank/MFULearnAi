import { UserMemory, IUserMemoryFact } from '../models/UserMemory';
import { LoggerService } from './LoggerService';
import { BedrockService } from './BedrockService';
import { SYSTEM_MODELS, computeWeightedTokens } from '../config/models';
import { redis } from '../config/redis';
import crypto from 'crypto';

/**
 * UserMemoryService — Cross-session persistent memory manager.
 *
 * Manages a global knowledge store per user that spans all conversations.
 * Facts are automatically extracted from conversations and can be
 * explicitly added/modified by the user.
 *
 * Architecture:
 *   - MongoDB for persistence
 *   - Redis for hot cache (5-min TTL)
 *   - LLM-powered fact extraction
 *   - Automatic deduplication and conflict resolution
 *   - Configurable max facts with auto-archival
 *
 * Integration:
 *   - Called by SummarizationService after each conversation turn
 *   - Injected into PromptBuilder system prompt as user context
 *   - Exposed via ChatController for user self-management
 */

const CACHE_PREFIX = 'user_memory:';
const CACHE_TTL = 300; // 5 minutes
const MAX_FACTS_DEFAULT = 50;

const EXTRACTION_PROMPT = `You are a Memory Extraction AI. Extract persistent facts about the user from the conversation.

ONLY extract information that should be remembered across ALL future conversations. Ignore:
- Temporary/session-specific queries
- Generic questions about topics
- Anything already in "Existing Memory"

For each fact, output JSON:
<json>
[
  {
    "content": "concise fact about the user",
    "category": "preference|biographical|project|expertise|instruction|other",
    "confidence": 0.0 to 1.0
  }
]
</json>

If NO cross-session facts found, output: <json>[]</json>`;

export class UserMemoryService {

    /**
     * Get user memory for prompt injection. Returns compact summary string.
     * Cached in Redis for performance.
     */
    static async getMemoryForPrompt(userId: string): Promise<string> {
        try {
            // Redis cache check
            const cacheKey = `${CACHE_PREFIX}${userId}`;
            const cached = await redis.get(cacheKey);
            if (cached) return cached;

            const memory = await UserMemory.findOne({ userId }).lean();
            if (!memory || !memory.facts || memory.facts.length === 0) {
                return '';
            }

            // Build compact summary from active facts
            const activeFacts = (memory.facts as IUserMemoryFact[])
                .filter(f => f.status === 'active' && f.confidence >= 0.5)
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 20); // Max 20 facts in prompt

            if (activeFacts.length === 0) return '';

            const summary = activeFacts
                .map(f => `- ${f.content}`)
                .join('\n');

            const result = `=== USER MEMORY (Cross-Session) ===\n${summary}`;

            // Cache in Redis
            await redis.set(cacheKey, result, 'EX', CACHE_TTL);

            // Update lastAccessedAt (fire-and-forget)
            UserMemory.updateOne({ userId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {});

            return result;
        } catch (err) {
            LoggerService.warn('user_memory_get_failed', {
                userId,
                error: err instanceof Error ? err.message : String(err)
            });
            return '';
        }
    }

    /**
     * Extract and store cross-session facts from a conversation turn.
     * Called as a background task after each turn.
     */
    static async extractAndStore(
        userId: string,
        sessionId: string,
        userMessage: string,
        assistantMessage: string
    ): Promise<void> {
        try {
            // Get existing memory for deduplication
            const memory = await this.getOrCreateMemory(userId);
            const existingFacts = (memory.facts as IUserMemoryFact[])
                .filter(f => f.status !== 'archived')
                .map(f => f.content);

            const prompt = `Existing Memory:
${existingFacts.length > 0 ? existingFacts.map(f => `- ${f}`).join('\n') : '(empty)'}

Latest Exchange:
User: ${userMessage}
Assistant: ${assistantMessage}`;

            const { text: response, usage } = await BedrockService.sendChat(
                SYSTEM_MODELS.UTILITY,
                [{ role: 'user', content: prompt }],
                EXTRACTION_PROMPT,
                0.1
            );

            if (usage) {
                LoggerService.info('chat_completion', {
                    tokens: usage,
                    weightedTokens: computeWeightedTokens(usage.total || 0, SYSTEM_MODELS.UTILITY),
                    model: SYSTEM_MODELS.UTILITY,
                    action: 'user_memory_extraction',
                    isBackground: true
                }, userId);
            }

            // Parse extracted facts
            const jsonMatch = response.match(/<json>([\s\S]*?)<\/json>/);
            const rawJson = jsonMatch ? jsonMatch[1].trim() : response.trim();
            const extractedFacts: Array<{ content: string; category: string; confidence: number }> = JSON.parse(rawJson);

            if (!Array.isArray(extractedFacts) || extractedFacts.length === 0) return;

            // Deduplicate and merge
            const newFacts: IUserMemoryFact[] = [];
            for (const extracted of extractedFacts) {
                if (!extracted.content || extracted.content.length < 3) continue;

                // Check for semantic duplicates (simple string containment)
                const isDuplicate = existingFacts.some(existing =>
                    existing.toLowerCase().includes(extracted.content.toLowerCase()) ||
                    extracted.content.toLowerCase().includes(existing.toLowerCase())
                );

                if (isDuplicate) {
                    // Boost confidence of existing matching fact
                    await UserMemory.updateOne(
                        { userId, 'facts.content': { $regex: extracted.content.substring(0, 30), $options: 'i' } },
                        {
                            $inc: { 'facts.$.hitCount': 1 },
                            $set: { 'facts.$.updatedAt': new Date() },
                            $max: { 'facts.$.confidence': Math.min(1.0, extracted.confidence + 0.1) }
                        }
                    );
                    continue;
                }

                newFacts.push({
                    id: crypto.randomUUID(),
                    content: extracted.content,
                    category: (extracted.category as IUserMemoryFact['category']) || 'other',
                    source: 'inferred',
                    status: 'tentative',
                    confidence: Math.max(0, Math.min(1, extracted.confidence || 0.5)),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    sourceSessionId: sessionId,
                    hitCount: 0
                });
            }

            if (newFacts.length === 0) return;

            // Add new facts
            await UserMemory.updateOne(
                { userId },
                {
                    $push: { facts: { $each: newFacts } },
                    $inc: { version: 1 },
                    $set: { updatedAt: new Date() }
                }
            );

            // Auto-archival if too many facts
            await this.archiveIfNeeded(userId);

            // Promote tentative facts that have been hit multiple times
            await this.promoteTentativeFacts(userId);

            // Invalidate cache
            await redis.del(`${CACHE_PREFIX}${userId}`);

            LoggerService.info('user_memory_facts_extracted', {
                userId,
                newFacts: newFacts.length,
                totalExisting: existingFacts.length
            });

        } catch (err) {
            LoggerService.warn('user_memory_extraction_failed', {
                userId,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    /**
     * Explicitly add a fact (user-initiated via "remember this").
     */
    static async addExplicitFact(
        userId: string,
        content: string,
        category: IUserMemoryFact['category'] = 'instruction',
        sessionId?: string
    ): Promise<IUserMemoryFact> {
        const fact: IUserMemoryFact = {
            id: crypto.randomUUID(),
            content,
            category,
            source: 'explicit',
            status: 'active', // Explicit facts are immediately active
            confidence: 1.0,
            createdAt: new Date(),
            updatedAt: new Date(),
            sourceSessionId: sessionId,
            hitCount: 0
        };

        await this.getOrCreateMemory(userId);
        await UserMemory.updateOne(
            { userId },
            {
                $push: { facts: fact },
                $inc: { version: 1 },
                $set: { updatedAt: new Date() }
            }
        );

        await redis.del(`${CACHE_PREFIX}${userId}`);
        LoggerService.info('user_memory_fact_added', { userId, factId: fact.id, category });

        return fact;
    }

    /**
     * Update or correct a fact.
     */
    static async updateFact(
        userId: string,
        factId: string,
        updates: { content?: string; category?: IUserMemoryFact['category']; status?: IUserMemoryFact['status'] }
    ): Promise<void> {
        const setFields: Record<string, any> = { 'facts.$.updatedAt': new Date() };
        if (updates.content) setFields['facts.$.content'] = updates.content;
        if (updates.category) setFields['facts.$.category'] = updates.category;
        if (updates.status) setFields['facts.$.status'] = updates.status;
        if (updates.content) {
            setFields['facts.$.source'] = 'corrected';
            setFields['facts.$.confidence'] = 1.0;
        }

        await UserMemory.updateOne(
            { userId, 'facts.id': factId },
            { $set: setFields, $inc: { version: 1 } }
        );

        await redis.del(`${CACHE_PREFIX}${userId}`);
        LoggerService.info('user_memory_fact_updated', { userId, factId, updates });
    }

    /**
     * Delete a fact.
     */
    static async deleteFact(userId: string, factId: string): Promise<void> {
        await UserMemory.updateOne(
            { userId },
            {
                $pull: { facts: { id: factId } },
                $inc: { version: 1 },
                $set: { updatedAt: new Date() }
            }
        );

        await redis.del(`${CACHE_PREFIX}${userId}`);
        LoggerService.info('user_memory_fact_deleted', { userId, factId });
    }

    /**
     * Get all facts for user management UI.
     */
    static async getUserMemory(userId: string): Promise<{
        facts: IUserMemoryFact[];
        version: number;
        lastAccessedAt: Date;
    }> {
        const memory = await UserMemory.findOne({ userId }).lean();
        if (!memory) {
            return { facts: [], version: 0, lastAccessedAt: new Date() };
        }
        return {
            facts: (memory.facts || []) as IUserMemoryFact[],
            version: memory.version,
            lastAccessedAt: memory.lastAccessedAt
        };
    }

    /**
     * Clear all memory for a user (GDPR or user-initiated).
     */
    static async clearAll(userId: string): Promise<void> {
        await UserMemory.deleteOne({ userId });
        await redis.del(`${CACHE_PREFIX}${userId}`);
        LoggerService.info('user_memory_cleared', { userId });
    }

    // ── Internal Helpers ────────────────────────────────────

    private static async getOrCreateMemory(userId: string) {
        let memory = await UserMemory.findOne({ userId });
        if (!memory) {
            memory = await UserMemory.create({
                userId,
                facts: [],
                summary: '',
                maxFacts: MAX_FACTS_DEFAULT,
                version: 0,
                lastAccessedAt: new Date()
            });
        }
        return memory;
    }

    /**
     * Archive lowest-confidence facts when max is exceeded.
     */
    private static async archiveIfNeeded(userId: string): Promise<void> {
        const memory = await UserMemory.findOne({ userId }).lean();
        if (!memory) return;

        const activeFacts = ((memory.facts || []) as IUserMemoryFact[]).filter(f => f.status !== 'archived');
        if (activeFacts.length <= (memory.maxFacts || MAX_FACTS_DEFAULT)) return;

        // Sort by confidence ASC, then hitCount ASC — archive least valuable first
        const sorted = [...activeFacts].sort((a, b) =>
            a.confidence - b.confidence || a.hitCount - b.hitCount
        );

        const toArchive = sorted.slice(0, activeFacts.length - (memory.maxFacts || MAX_FACTS_DEFAULT));

        for (const fact of toArchive) {
            await UserMemory.updateOne(
                { userId, 'facts.id': fact.id },
                { $set: { 'facts.$.status': 'archived', 'facts.$.updatedAt': new Date() } }
            );
        }

        LoggerService.info('user_memory_auto_archived', {
            userId,
            archivedCount: toArchive.length,
            remainingActive: activeFacts.length - toArchive.length
        });
    }

    /**
     * Promote tentative facts that have been referenced in multiple sessions.
     */
    private static async promoteTentativeFacts(userId: string): Promise<void> {
        // Promote tentative facts with hitCount >= 2 to active
        await UserMemory.updateMany(
            {
                userId,
                'facts.status': 'tentative',
                'facts.hitCount': { $gte: 2 }
            },
            {
                $set: {
                    'facts.$[elem].status': 'active',
                    'facts.$[elem].updatedAt': new Date()
                }
            },
            {
                arrayFilters: [{ 'elem.status': 'tentative', 'elem.hitCount': { $gte: 2 } }]
            }
        );
    }
}
