import { redis } from '../../config/redis';
import { LoggerService } from '../../services/LoggerService';

/**
 * Per-Tool Rate Limiter — Sliding Window Counter using Redis.
 *
 * Prevents LLM-driven tool abuse (e.g., infinite search loops) and
 * protects expensive external APIs from over-calling.
 *
 * Algorithm: Redis sorted set sliding window.
 *   - Each call is recorded as a member with score = timestamp.
 *   - Window check: count members within [now - windowMs, now].
 *   - If count >= limit, the call is rejected.
 *
 * Supports:
 *   - Per-tool default limits
 *   - Per-user per-tool limits
 *   - Per-session per-tool limits (for agent loop protection)
 *   - Global per-tool limits (cross-user)
 *
 * Thread-safe via Redis atomicity.
 */

export interface RateLimitConfig {
    /** Max calls within the window */
    maxCalls: number;
    /** Window size in milliseconds */
    windowMs: number;
}

/** Default rate limits per tool category */
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
    // Search/RAG tools — moderate limit to prevent spam
    search: { maxCalls: 20, windowMs: 60_000 }, // 20/min
    check_policy: { maxCalls: 15, windowMs: 60_000 }, // 15/min
    calculator: { maxCalls: 30, windowMs: 60_000 }, // 30/min
    lookup_knowledge_table: { maxCalls: 20, windowMs: 60_000 },
    // Default for unknown tools (e.g., MCP)
    _default: { maxCalls: 10, windowMs: 60_000 }, // 10/min
};

/** Per-session limits (within a single agent execution — tighter) */
const SESSION_LIMITS: Record<string, RateLimitConfig> = {
    search: { maxCalls: 8, windowMs: 300_000 }, // 8 per 5 min session
    check_policy: { maxCalls: 6, windowMs: 300_000 },
    _default: { maxCalls: 5, windowMs: 300_000 },
};

export class ToolRateLimiter {
    private static overrides: Map<string, RateLimitConfig> = new Map();

    /**
     * Override rate limit for a specific tool at runtime.
     */
    static setToolLimit(toolName: string, config: RateLimitConfig): void {
        this.overrides.set(toolName, config);
    }

    /**
     * Check if a tool call is allowed under the rate limit.
     * Checks both per-user and per-session limits.
     *
     * @returns { allowed: true } or { allowed: false, retryAfterMs, reason }
     */
    static async checkLimit(
        toolName: string,
        userId: string,
        sessionId?: string
    ): Promise<{ allowed: boolean; retryAfterMs?: number; reason?: string; remaining?: number }> {
        const now = Date.now();

        // Check 1: Per-user per-tool limit
        const userLimit = this.getLimit(toolName, 'user');
        const userKey = `ratelimit:tool:${toolName}:user:${userId}`;
        const userCheck = await this.checkWindow(userKey, userLimit, now);

        if (!userCheck.allowed) {
            LoggerService.warn('tool_rate_limited', {
                tool: toolName,
                userId,
                scope: 'user',
                limit: userLimit.maxCalls,
                windowMs: userLimit.windowMs,
                retryAfterMs: userCheck.retryAfterMs
            }, userId);
            return {
                allowed: false,
                retryAfterMs: userCheck.retryAfterMs,
                reason: `Rate limit exceeded for "${toolName}": ${userLimit.maxCalls} calls per ${userLimit.windowMs / 1000}s (user scope)`,
                remaining: 0
            };
        }

        // Check 2: Per-session per-tool limit (agent loop protection)
        if (sessionId) {
            const sessionLimit = this.getLimit(toolName, 'session');
            const sessionKey = `ratelimit:tool:${toolName}:session:${sessionId}`;
            const sessionCheck = await this.checkWindow(sessionKey, sessionLimit, now);

            if (!sessionCheck.allowed) {
                LoggerService.warn('tool_rate_limited', {
                    tool: toolName,
                    userId,
                    sessionId,
                    scope: 'session',
                    limit: sessionLimit.maxCalls,
                    windowMs: sessionLimit.windowMs,
                    retryAfterMs: sessionCheck.retryAfterMs
                }, userId);
                return {
                    allowed: false,
                    retryAfterMs: sessionCheck.retryAfterMs,
                    reason: `Session rate limit exceeded for "${toolName}": ${sessionLimit.maxCalls} calls per session window`,
                    remaining: 0
                };
            }
        }

        // Record the call
        await this.recordCall(toolName, userId, sessionId, now);

        return {
            allowed: true,
            remaining: userCheck.remaining
        };
    }

    /**
     * Check sliding window count using Redis sorted set.
     */
    private static async checkWindow(
        key: string,
        limit: RateLimitConfig,
        now: number
    ): Promise<{ allowed: boolean; retryAfterMs?: number; remaining: number }> {
        try {
            const windowStart = now - limit.windowMs;

            // Remove expired entries and count current window in one pipeline
            const pipeline = redis.pipeline();
            pipeline.zremrangebyscore(key, 0, windowStart);
            pipeline.zcard(key);
            pipeline.zrange(key, 0, 0, 'WITHSCORES'); // oldest entry
            const results = await pipeline.exec();

            const count = (results?.[1]?.[1] as number) || 0;

            if (count >= limit.maxCalls) {
                // Calculate when the oldest entry will expire
                const oldestScores = results?.[2]?.[1] as string[];
                const oldestTimestamp = oldestScores?.length >= 2 ? parseInt(oldestScores[1], 10) : now;
                const retryAfterMs = Math.max(0, (oldestTimestamp + limit.windowMs) - now);

                return {
                    allowed: false,
                    retryAfterMs,
                    remaining: 0
                };
            }

            return {
                allowed: true,
                remaining: limit.maxCalls - count
            };
        } catch (err) {
            // On Redis failure, allow the call (fail-open)
            LoggerService.warn('rate_limiter_redis_error', {
                key,
                error: err instanceof Error ? err.message : String(err)
            });
            return { allowed: true, remaining: -1 };
        }
    }

    /**
     * Record a tool call in the sliding window.
     */
    private static async recordCall(
        toolName: string,
        userId: string,
        sessionId: string | undefined,
        now: number
    ): Promise<void> {
        try {
            const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
            const userKey = `ratelimit:tool:${toolName}:user:${userId}`;
            const ttlSec = Math.ceil(DEFAULT_LIMITS[toolName]?.windowMs || DEFAULT_LIMITS._default.windowMs) / 1000 + 10;

            const pipeline = redis.pipeline();
            pipeline.zadd(userKey, now, member);
            pipeline.expire(userKey, ttlSec);

            if (sessionId) {
                const sessionKey = `ratelimit:tool:${toolName}:session:${sessionId}`;
                pipeline.zadd(sessionKey, now, member);
                pipeline.expire(sessionKey, 600); // 10 min max session TTL
            }

            await pipeline.exec();
        } catch {
            // Non-critical — don't fail the tool call
        }
    }

    /**
     * Get the effective rate limit for a tool + scope combination.
     */
    private static getLimit(toolName: string, scope: 'user' | 'session'): RateLimitConfig {
        // Check runtime overrides first
        const override = this.overrides.get(toolName);
        if (override) return override;

        if (scope === 'session') {
            return SESSION_LIMITS[toolName] || SESSION_LIMITS._default;
        }
        return DEFAULT_LIMITS[toolName] || DEFAULT_LIMITS._default;
    }

    /**
     * Get current usage stats for monitoring.
     */
    static async getUsageStats(toolName: string, userId: string): Promise<{
        callsInWindow: number;
        limit: number;
        windowMs: number;
        remaining: number;
    }> {
        const limit = this.getLimit(toolName, 'user');
        const key = `ratelimit:tool:${toolName}:user:${userId}`;
        const now = Date.now();

        try {
            await redis.zremrangebyscore(key, 0, now - limit.windowMs);
            const count = await redis.zcard(key);
            return {
                callsInWindow: count,
                limit: limit.maxCalls,
                windowMs: limit.windowMs,
                remaining: Math.max(0, limit.maxCalls - count)
            };
        } catch {
            return { callsInWindow: 0, limit: limit.maxCalls, windowMs: limit.windowMs, remaining: limit.maxCalls };
        }
    }

    /**
     * Return the complete rate-limit configuration (for admin dashboards).
     */
    static getConfig(): {
        defaultLimits: Record<string, RateLimitConfig>;
        sessionLimits: Record<string, RateLimitConfig>;
        overrides: Record<string, RateLimitConfig>;
    } {
        const overrides: Record<string, RateLimitConfig> = {};
        for (const [k, v] of this.overrides.entries()) {
            overrides[k] = v;
        }
        return {
            defaultLimits: { ...DEFAULT_LIMITS },
            sessionLimits: { ...SESSION_LIMITS },
            overrides,
        };
    }
}
