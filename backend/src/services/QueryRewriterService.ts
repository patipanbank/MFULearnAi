import { BedrockService } from './BedrockService';
import { LoggerService } from './LoggerService';
import { SYSTEM_MODELS } from '../config/models';
import { redis } from '../config/redis';

/**
 * QueryRewriterService — LLM-powered query rewriting for RAG retrieval.
 *
 * **Why**: User queries are often short, vague, or conversational.
 * Dense embeddings struggle with:
 *   - Implicit intent ("ระเบียบเรื่องขาดเรียน" → needs expansion)
 *   - Thai abbreviations & colloquialisms
 *   - Ambiguous pronouns (references to chat history)
 *
 * **How**: Before the embedding search, this service calls a lightweight
 * LLM (Qwen 80B-A3B — $0.10 cost weight) to reformulate the query into
 * a more precise, embedding-friendly version.
 *
 * **Techniques implemented**:
 *   1. Query Expansion — adds synonyms and related terms
 *   2. Intent Clarification — disambiguates vague phrasing
 *   3. Multi-query Generation — produces 2-3 sub-queries for broader recall
 *   4. Language Normalization — handles Thai-English code-switching
 *
 * **Performance guards**:
 *   - Redis cache (5 min TTL) — identical queries skip the LLM call
 *   - Timeout (3s) — falls back to original query on timeout
 *   - Short-circuit — queries < 5 chars or > 500 chars skip rewriting
 *   - Non-blocking — errors never break the search pipeline
 */

/** Result of a query rewrite operation */
export interface RewriteResult {
    /** The primary rewritten query (always present, may be original on fallback) */
    rewrittenQuery: string;
    /** Additional sub-queries for multi-query retrieval (optional) */
    subQueries: string[];
    /** Whether the LLM was actually called (false = cache hit or short-circuit) */
    wasRewritten: boolean;
    /** Latency in ms */
    latencyMs: number;
}

/** Configuration for the rewriter */
interface RewriterConfig {
    /** Model to use for rewriting */
    modelId: string;
    /** Max wait time before falling back to original query */
    timeoutMs: number;
    /** Redis cache TTL in seconds */
    cacheTtlSeconds: number;
    /** Min query length to trigger rewriting */
    minQueryLength: number;
    /** Max query length to trigger rewriting */
    maxQueryLength: number;
    /** Temperature for the rewrite LLM call */
    temperature: number;
}

const DEFAULT_CONFIG: RewriterConfig = {
    modelId: SYSTEM_MODELS.SUMMARIZE, // Qwen 80B-A3B — fast + cheap ($0.10 weight)
    timeoutMs: parseInt(process.env.QUERY_REWRITE_TIMEOUT_MS || '3000', 10),
    cacheTtlSeconds: parseInt(process.env.QUERY_REWRITE_CACHE_TTL || '300', 10),
    minQueryLength: 5,
    maxQueryLength: 500,
    temperature: 0.1,
};

const REWRITE_SYSTEM_PROMPT = `You are a search query optimizer for a knowledge base retrieval system.
Your job is to rewrite user queries to maximize retrieval quality from a vector database.

The knowledge base contains Thai university documents: policies, regulations, academic guidelines, student handbooks, PDPA rules, HR policies, and general information.

RULES:
1. Expand abbreviations and colloquialisms into formal terms.
2. Add 2-3 relevant synonyms or related terms that might appear in documents.
3. If the query is in Thai, keep it in Thai but add formal/official terminology.
4. If the query mixes Thai and English, normalize to whichever is dominant.
5. Remove conversational fillers ("ช่วยหาให้หน่อย", "อยากรู้ว่า", etc.).
6. Generate 1-2 alternative sub-queries that approach the same intent from different angles.
7. Keep each query concise (under 100 chars).

Return ONLY valid JSON (no markdown, no code fences):
{
  "rewritten": "the improved primary query",
  "subQueries": ["alternative query 1", "alternative query 2"]
}`;

export class QueryRewriterService {
    private static config: RewriterConfig = { ...DEFAULT_CONFIG };

    /**
     * Override configuration at runtime (for testing or tuning).
     */
    static configure(overrides: Partial<RewriterConfig>): void {
        this.config = { ...this.config, ...overrides };
    }

    /**
     * Rewrite a user query for better retrieval quality.
     *
     * This is the main entry point — called by SearchTool and PolicyCheckerTool
     * before passing the query to KnowledgeService.search().
     *
     * @param originalQuery - The raw user/agent query
     * @param context - Optional additional context (e.g., from agent)
     * @returns RewriteResult with rewritten query and optional sub-queries
     */
    static async rewrite(
        originalQuery: string,
        context?: string
    ): Promise<RewriteResult> {
        const start = Date.now();

        // Short-circuit: skip rewriting for very short or very long queries
        if (
            !originalQuery ||
            originalQuery.length < this.config.minQueryLength ||
            originalQuery.length > this.config.maxQueryLength
        ) {
            return {
                rewrittenQuery: originalQuery,
                subQueries: [],
                wasRewritten: false,
                latencyMs: Date.now() - start,
            };
        }

        // Check Redis cache first
        const cacheKey = `qrewrite:${this.hashQuery(originalQuery, context)}`;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as RewriteResult;
                parsed.latencyMs = Date.now() - start;
                LoggerService.debug('query_rewrite_cache_hit', { originalQuery });
                return parsed;
            }
        } catch {
            // Cache miss or Redis error — proceed with LLM call
        }

        // Call LLM with timeout
        try {
            const result = await this.callWithTimeout(originalQuery, context);
            result.latencyMs = Date.now() - start;

            // Cache the result
            try {
                await redis.set(
                    cacheKey,
                    JSON.stringify(result),
                    'EX',
                    this.config.cacheTtlSeconds
                );
            } catch {
                // Non-critical — cache write failure doesn't affect the result
            }

            LoggerService.info('query_rewrite_success', {
                originalQuery,
                rewrittenQuery: result.rewrittenQuery,
                subQueryCount: result.subQueries.length,
                latencyMs: result.latencyMs,
            });

            return result;
        } catch (error: any) {
            LoggerService.warn('query_rewrite_fallback', {
                originalQuery,
                error: error.message,
                latencyMs: Date.now() - start,
            });

            // Graceful fallback — return original query
            return {
                rewrittenQuery: originalQuery,
                subQueries: [],
                wasRewritten: false,
                latencyMs: Date.now() - start,
            };
        }
    }

    /**
     * Call the LLM with a strict timeout.
     * Rejects the promise if the LLM takes too long.
     */
    private static async callWithTimeout(
        query: string,
        context?: string
    ): Promise<RewriteResult> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
                () => reject(new Error(`Query rewrite timed out after ${this.config.timeoutMs}ms`)),
                this.config.timeoutMs
            );
        });

        const rewritePromise = this.performRewrite(query, context);

        return Promise.race([rewritePromise, timeoutPromise]);
    }

    /**
     * The actual LLM rewrite call.
     */
    private static async performRewrite(
        query: string,
        context?: string
    ): Promise<RewriteResult> {
        const userMessage = context
            ? `Query: "${query}"\nAdditional context: "${context}"`
            : `Query: "${query}"`;

        const { text: llmResponse } = await BedrockService.sendChat(
            this.config.modelId,
            [{ role: 'user', content: userMessage }],
            REWRITE_SYSTEM_PROMPT,
            this.config.temperature
        );

        // Parse the LLM response
        return this.parseResponse(query, llmResponse);
    }

    /**
     * Parse LLM JSON response with graceful fallback.
     */
    private static parseResponse(originalQuery: string, raw: string): RewriteResult {
        try {
            // Strip markdown fences if present
            let cleaned = raw.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(cleaned);

            const rewritten = typeof parsed.rewritten === 'string' && parsed.rewritten.trim()
                ? parsed.rewritten.trim()
                : originalQuery;

            const subQueries = Array.isArray(parsed.subQueries)
                ? parsed.subQueries
                    .filter((q: unknown) => typeof q === 'string' && (q as string).trim())
                    .map((q: string) => q.trim())
                    .slice(0, 3) // Max 3 sub-queries
                : [];

            return {
                rewrittenQuery: rewritten,
                subQueries,
                wasRewritten: rewritten !== originalQuery,
                latencyMs: 0, // Will be set by caller
            };
        } catch {
            // JSON parse failed — try to extract useful text anyway
            LoggerService.warn('query_rewrite_parse_error', {
                originalQuery,
                rawResponse: raw.substring(0, 200),
            });

            return {
                rewrittenQuery: originalQuery,
                subQueries: [],
                wasRewritten: false,
                latencyMs: 0,
            };
        }
    }

    /**
     * Simple hash for cache key generation.
     */
    private static hashQuery(query: string, context?: string): string {
        const input = context ? `${query}||${context}` : query;
        // Simple FNV-1a-like hash for short strings
        let hash = 2166136261;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = (hash * 16777619) >>> 0;
        }
        return hash.toString(36);
    }
}
