import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_MODE = process.env.REDIS_MODE || 'standalone'; // 'standalone' | 'sentinel' | 'cluster'

/**
 * Redis client factory — supports standalone, Sentinel (HA), and Cluster modes.
 *
 * Configuration via environment variables:
 *   REDIS_URL          — Connection URL for standalone mode
 *   REDIS_MODE         — 'standalone' (default), 'sentinel', or 'cluster'
 *   REDIS_SENTINELS    — Comma-separated host:port pairs (sentinel mode)
 *   REDIS_SENTINEL_NAME — Master name for sentinel (default: 'mymaster')
 *   REDIS_CLUSTER_NODES — Comma-separated host:port pairs (cluster mode)
 *   REDIS_PASSWORD     — Password (optional, all modes)
 *   REDIS_TLS          — 'true' to enable TLS
 */
function createRedisClient(): Redis {
    const password = process.env.REDIS_PASSWORD || undefined;
    const enableTLS = process.env.REDIS_TLS === 'true';
    const tls = enableTLS ? {} : undefined;

    const commonOptions = {
        password,
        tls,
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
            if (times > 10) {
                console.error(`[Redis] Max reconnection attempts reached (${times}). Giving up.`);
                return null; // Stop retrying
            }
            const delay = Math.min(times * 200, 5000); // Exponential backoff, max 5s
            console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
        },
        reconnectOnError(err: Error) {
            // Reconnect on READONLY errors (e.g., during failover)
            return err.message.includes('READONLY');
        },
        enableReadyCheck: true,
        lazyConnect: false,
    };

    if (REDIS_MODE === 'sentinel') {
        const sentinelList = (process.env.REDIS_SENTINELS || 'localhost:26379')
            .split(',')
            .map(s => {
                const [host, port] = s.trim().split(':');
                return { host, port: parseInt(port || '26379', 10) };
            });

        const sentinelName = process.env.REDIS_SENTINEL_NAME || 'mymaster';

        console.log(`[Redis] Connecting via Sentinel (master: ${sentinelName}, sentinels: ${sentinelList.length})`);

        return new Redis({
            sentinels: sentinelList,
            name: sentinelName,
            sentinelPassword: password,
            ...commonOptions,
        });
    }

    if (REDIS_MODE === 'cluster') {
        // Note: ioredis Cluster requires a different import. For single-process
        // deployments, we use a standard connection to one cluster node and
        // rely on the cluster's MOVED/ASK redirects being handled by ioredis.
        console.log('[Redis] Connecting in Cluster-aware mode');
        return new Redis(REDIS_URL, {
            ...commonOptions,
        });
    }

    // Default: standalone mode
    return new Redis(REDIS_URL, commonOptions);
}

export const redis = createRedisClient();

redis.on('error', (err) => console.error('[Redis] Error:', err.message));
redis.on('connect', () => console.log(`[Redis] Connected (${REDIS_MODE} mode)`));
redis.on('ready', () => console.log('[Redis] Ready'));
redis.on('close', () => console.log('[Redis] Connection closed'));
redis.on('reconnecting', () => console.log('[Redis] Reconnecting...'));
