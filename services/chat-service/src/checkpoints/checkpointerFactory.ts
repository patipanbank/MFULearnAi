import { Checkpointer } from "@langchain/langgraph-checkpoint";
import { createRedisCheckpointer, closeRedisCheckpointer } from "./redisCheckpointer";
import { createPostgresCheckpointer, closePostgresCheckpointer } from "./postgresCheckpointer";
import config from "../config/config";
import logger from "../utils/logger";

/**
 * Checkpointer Factory
 * Creates appropriate checkpointer based on configuration
 * Defaults to Redis for production due to better performance
 */

type CheckpointerType = 'redis' | 'postgres' | 'memory';

/**
 * Get checkpointer type from environment
 */
function getCheckpointerType(): CheckpointerType {
  const type = process.env.CHECKPOINTER_TYPE?.toLowerCase() as CheckpointerType;

  if (type === 'postgres') {
    return 'postgres';
  }

  // Default to Redis for production
  return 'redis';
}

/**
 * Create checkpointer based on configuration
 */
export async function getCheckpointer(): Promise<Checkpointer> {
  const type = getCheckpointerType();

  logger.info(`🔧 Creating checkpointer of type: ${type}`);

  switch (type) {
    case 'postgres':
      return await createPostgresCheckpointer();

    case 'redis':
    default:
      return await createRedisCheckpointer();
  }
}

/**
 * Close all checkpointer connections
 */
export async function closeAllCheckpointers(): Promise<void> {
  logger.info('🔒 Closing all checkpointer connections');

  await Promise.all([
    closeRedisCheckpointer(),
    closePostgresCheckpointer(),
  ]);

  logger.info('✅ All checkpointers closed');
}

/**
 * Health check for active checkpointer
 */
export async function checkCheckpointerHealth(): Promise<boolean> {
  const type = getCheckpointerType();

  try {
    if (type === 'postgres') {
      const { checkPostgresHealth } = await import('./postgresCheckpointer');
      return await checkPostgresHealth();
    } else {
      const { checkRedisHealth } = await import('./redisCheckpointer');
      return await checkRedisHealth();
    }
  } catch (error) {
    logger.error('❌ Checkpointer health check failed', { error, type });
    return false;
  }
}
