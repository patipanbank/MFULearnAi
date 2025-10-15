import http from 'http';
import { createApp, connectDatabase, closeDatabase } from './app';
import { WebSocketController } from './controllers/websocketController';
import { closeAllCheckpointers } from './checkpoints/checkpointerFactory';
import config from './config/config';
import logger from './utils/logger';

/**
 * Server Entry Point
 * Initializes Express app, WebSocket server, and database connections
 */

let server: http.Server | null = null;
let wsController: WebSocketController | null = null;

async function startServer() {
  try {
    logger.info('🚀 Starting Chat Service...', {
      environment: config.APP_ENV,
      port: config.PORT,
    });

    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = createApp();

    // Create HTTP server
    server = http.createServer(app);

    // Initialize WebSocket controller
    wsController = new WebSocketController(server);

    // Start server
    await new Promise<void>((resolve, reject) => {
      server!.listen(config.PORT, () => {
        resolve();
      });

      server!.on('error', (error) => {
        reject(error);
      });
    });

    logger.info('✅ Chat Service started successfully', {
      port: config.PORT,
      environment: config.APP_ENV,
      pid: process.pid,
    });

    logger.info('📍 Endpoints available:', {
      health: `http://localhost:${config.PORT}/health`,
      api: `http://localhost:${config.PORT}/api/chat`,
      websocket: `ws://localhost:${config.PORT}/ws`,
    });

  } catch (error: any) {
    logger.error('❌ Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

async function stopServer() {
  logger.info('🛑 Stopping Chat Service...');

  try {
    // Close WebSocket connections
    if (wsController) {
      await wsController.close();
      wsController = null;
    }

    // Close HTTP server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      server = null;
    }

    // Close database connection
    await closeDatabase();

    // Close checkpointer connections
    await closeAllCheckpointers();

    logger.info('✅ Chat Service stopped successfully');
    process.exit(0);

  } catch (error: any) {
    logger.error('❌ Error during shutdown', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('⚠️ SIGTERM signal received');
  await stopServer();
});

process.on('SIGINT', async () => {
  logger.info('⚠️ SIGINT signal received');
  await stopServer();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection', {
    reason,
    promise,
  });
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  logger.error('❌ Fatal error during startup', { error });
  process.exit(1);
});
