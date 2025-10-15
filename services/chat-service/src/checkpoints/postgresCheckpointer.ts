import { MemorySaver } from "@langchain/langgraph";
import { Pool } from "pg";
import config from "../config/config";
import logger from "../utils/logger";

/**
 * PostgreSQL Checkpointer for LangGraph
 * Using MemorySaver for now until Postgres checkpointer is available
 * For production, state is persisted in MongoDB via chatService
 */

let pgPool: Pool | null = null;
let memorySaver: MemorySaver | null = null;

/**
 * Create or get PostgreSQL pool (for future use)
 */
function getPostgresPool(): Pool {
  if (!pgPool) {
    logger.info('📦 Creating PostgreSQL connection pool', {
      url: config.POSTGRES_URL ? 'configured' : 'not configured',
    });

    if (!config.POSTGRES_URL) {
      throw new Error('POSTGRES_URL not configured');
    }

    pgPool = new Pool({
      connectionString: config.POSTGRES_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pgPool.on('connect', () => {
      logger.info('✅ PostgreSQL client connected');
    });

    pgPool.on('error', (err) => {
      logger.error('❌ PostgreSQL client error', { error: err.message });
    });
  }

  return pgPool;
}

/**
 * Create Postgres Saver (Checkpointer)
 * Using MemorySaver for now
 */
export async function createPostgresCheckpointer(): Promise<MemorySaver> {
  if (!memorySaver) {
    logger.info('🔧 Creating Memory checkpointer (Postgres integration pending)');

    // Initialize Postgres pool for health checks if URL is configured
    if (config.POSTGRES_URL) {
      try {
        getPostgresPool();
      } catch (error: any) {
        logger.warn('⚠️ Postgres pool initialization skipped', { error: error.message });
      }
    }

    // Use MemorySaver for now
    memorySaver = new MemorySaver();

    logger.info('✅ Memory checkpointer created successfully');
  }

  return memorySaver;
}

/**
 * Close PostgreSQL connection
 */
export async function closePostgresCheckpointer(): Promise<void> {
  if (pgPool) {
    logger.info('🔒 Closing PostgreSQL connection pool');
    await pgPool.end();
    pgPool = null;
  }
  memorySaver = null;
}

/**
 * Health check for PostgreSQL
 */
export async function checkPostgresHealth(): Promise<boolean> {
  try {
    if (!config.POSTGRES_URL) {
      return false;
    }

    if (!pgPool) {
      getPostgresPool();
    }

    const result = await pgPool!.query('SELECT 1');
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error: any) {
    logger.error('❌ PostgreSQL health check failed', { error: error.message });
    return false;
  }
}
