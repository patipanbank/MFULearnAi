import { MemorySaver } from "@langchain/langgraph";
import Redis from "ioredis";
import config from "../config/config";
import logger from "../utils/logger";

/**
 * Redis Checkpointer for LangGraph
 * Using MemorySaver for now until Redis checkpointer is available
 * For production, state is persisted in MongoDB via chatService
 */

let redisClient: Redis | null = null;
let memorySaver: MemorySaver | null = null;

/**
 * Create or get Redis client (for future use)
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    logger.info('📦 Creating Redis client', {
      url: config.REDIS_URL,
    });

    redisClient = new Redis(config.REDIS_URL, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Redis client error', { error: err.message });
    });

    redisClient.on('close', () => {
      logger.warn('⚠️ Redis client connection closed');
    });
  }

  return redisClient;
}

/**
 * Create Memory Saver (Checkpointer)
 * Using in-memory checkpointer for now
 */
export async function createRedisCheckpointer(): Promise<MemorySaver> {
  if (!memorySaver) {
    logger.info('🔧 Creating Memory checkpointer (Redis integration pending)');

    // Initialize Redis client for health checks
    getRedisClient();

    // Use MemorySaver for now
    memorySaver = new MemorySaver();

    logger.info('✅ Memory checkpointer created successfully');
  }

  return memorySaver;
}

/**
 * Close Redis connection
 */
export async function closeRedisCheckpointer(): Promise<void> {
  if (redisClient) {
    logger.info('🔒 Closing Redis client connection');
    await redisClient.quit();
    redisClient = null;
  }
  memorySaver = null;
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!redisClient) {
      getRedisClient();
    }

    const result = await redisClient!.ping();
    return result === 'PONG';
  } catch (error: any) {
    logger.error('❌ Redis health check failed', { error: error.message });
    return false;
  }
}
