import { redis } from '../../config/redis';

/**
 * Redis-based Distributed Lock (Simplified Redlock for single-node).
 *
 * Prevents concurrent writes to the same chat session by acquiring
 * an exclusive lock before mutation operations. Uses SET NX EX for
 * atomic lock acquisition with automatic expiry (prevents deadlocks).
 *
 * Usage:
 *   const release = await acquireSessionLock(userId, sessionId);
 *   try {
 *       // ... mutate session ...
 *   } finally {
 *       await release();
 *   }
 *
 * Or use the helper:
 *   await withSessionLock(userId, sessionId, async () => { ... });
 */

const LOCK_PREFIX = 'lock:session:';
const DEFAULT_TTL_MS = 10_000;     // 10 seconds max hold time
const RETRY_DELAY_MS = 50;         // 50ms between retries
const MAX_RETRIES = 60;            // 60 retries × 50ms = 3 seconds max wait

/**
 * Acquire an exclusive lock on a session.
 * Returns a release function that MUST be called when done.
 *
 * @throws Error if lock cannot be acquired within timeout
 */
export async function acquireSessionLock(
    userId: string,
    sessionId: string,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<() => Promise<void>> {
    const lockKey = `${LOCK_PREFIX}${userId}:${sessionId}`;
    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const ttlSec = Math.ceil(ttlMs / 1000);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        // SET NX EX — atomic acquire with expiry
        const acquired = await redis.set(lockKey, lockValue, 'EX', ttlSec, 'NX');

        if (acquired === 'OK') {
            // Return release function (uses Lua script for safe release)
            return async () => {
                // Only release if we still own the lock (compare-and-delete)
                const script = `
                    if redis.call("get", KEYS[1]) == ARGV[1] then
                        return redis.call("del", KEYS[1])
                    else
                        return 0
                    end
                `;
                try {
                    await redis.eval(script, 1, lockKey, lockValue);
                } catch {
                    // Ignore release errors — TTL will clean up
                }
            };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }

    // Timeout — couldn't acquire lock
    throw new Error(`[SessionLock] Failed to acquire lock for session ${sessionId} after ${MAX_RETRIES * RETRY_DELAY_MS}ms`);
}

/**
 * Execute a function while holding an exclusive session lock.
 * Automatically acquires and releases the lock.
 */
export async function withSessionLock<T>(
    userId: string,
    sessionId: string,
    fn: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
    const release = await acquireSessionLock(userId, sessionId, ttlMs);
    try {
        return await fn();
    } finally {
        await release();
    }
}

/**
 * Check if a session is currently locked (for diagnostics only).
 */
export async function isSessionLocked(userId: string, sessionId: string): Promise<boolean> {
    const lockKey = `${LOCK_PREFIX}${userId}:${sessionId}`;
    const exists = await redis.exists(lockKey);
    return exists === 1;
}
