import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { QUOTA_CONFIG } from '../config/quotas';
import LogEntry from '../infra/logger/models/LogEntry';

const ENV_TYPE = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';

/**
 * Returns the Bangkok start-of-day in UTC (for cache key + DB query).
 */
function getTodayKeyAndStart(): { key: string; startOfDayUTC: Date } {
    const TZ_OFFSET = 7 * 60 * 60 * 1000;
    const bangkokNow = new Date(Date.now() + TZ_OFFSET);
    const dateStr = `${bangkokNow.getUTCFullYear()}-${String(bangkokNow.getUTCMonth() + 1).padStart(2, '0')}-${String(bangkokNow.getUTCDate()).padStart(2, '0')}`;
    const startOfDay = new Date(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate());
    return {
        key: dateStr,
        startOfDayUTC: new Date(startOfDay.getTime() - TZ_OFFSET)
    };
}

/**
 * Get the user's weighted token usage for today.
 * Tries Redis cache first (60s TTL), falls back to MongoDB aggregate.
 */
async function getTodayUsage(userId: string): Promise<number> {
    const { key: dateKey, startOfDayUTC } = getTodayKeyAndStart();
    const cacheKey = `quota:${userId}:${dateKey}`;

    // 1. Try Redis
    try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) return parseInt(cached, 10);
    } catch { /* Redis down — fall through */ }

    // 2. Aggregate from MongoDB
    const weightedTokenExpr = {
        $ifNull: [
            "$details.weightedTokens",
            {
                $cond: [
                    { $eq: ["$action", "chat_completion"] },
                    { $ifNull: ["$details.tokens.total", 0] },
                    { $ifNull: ["$details.totalTokens", 0] }
                ]
            }
        ]
    };

    const result = await LogEntry.aggregate([
        {
            $match: {
                action: { $in: ['chat_completion', 'agent_reliability_telemetry'] },
                environment: ENV_TYPE,
                userId,
                timestamp: { $gte: startOfDayUTC }
            }
        },
        { $group: { _id: null, total: { $sum: weightedTokenExpr } } }
    ]);

    const usage = result[0]?.total || 0;

    // 3. Cache for 60 seconds
    try {
        await redis.set(cacheKey, String(usage), 'EX', 60);
    } catch { /* ignore */ }

    return usage;
}

/**
 * Express middleware that rejects chat requests when the user has exceeded
 * their daily token quota **and** HARD_LIMIT_ENABLED is true.
 *
 * Must be placed after authentication middleware (needs `req.user.userId`).
 */
export async function quotaEnforcer(req: Request, res: Response, next: NextFunction) {
    if (!QUOTA_CONFIG.HARD_LIMIT_ENABLED) return next();

    try {
        const userId = (req as any).user?.userId;
        if (!userId) return next(); // No user context — let downstream handle it

        const usage = await getTodayUsage(userId);

        if (usage >= QUOTA_CONFIG.DAILY_LIMIT) {
            return res.status(429).json({
                error: 'daily_quota_exceeded',
                message: `คุณใช้งานเกินโควตาประจำวันแล้ว (${usage.toLocaleString()} / ${QUOTA_CONFIG.DAILY_LIMIT.toLocaleString()} ${QUOTA_CONFIG.UNIT_LABEL})`,
                usage,
                limit: QUOTA_CONFIG.DAILY_LIMIT,
                retryAfter: 'tomorrow'
            });
        }

        next();
    } catch (err) {
        // If quota check fails, let the request through (fail-open)
        console.error('[QuotaEnforcer] Error checking quota, allowing request:', err);
        next();
    }
}
