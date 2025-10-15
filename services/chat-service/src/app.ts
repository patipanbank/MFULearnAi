import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import config from './config/config';
import logger from './utils/logger';
import { chatRouter } from './controllers/chatController';
import { authenticateJWT } from './middleware/auth';
import { checkCheckpointerHealth } from './checkpoints/checkpointerFactory';

/**
 * Express Application Setup
 */

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
  }));

  // CORS configuration
  app.use(cors({
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parser middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('user-agent'),
      });
    });

    next();
  });

  // Health check endpoint (no auth required)
  app.get('/health', async (req: Request, res: Response) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chat-service',
      version: '1.0.0',
      checks: {
        mongodb: mongoose.connection.readyState === 1,
        checkpointer: await checkCheckpointerHealth(),
      },
    };

    const isHealthy = health.checks.mongodb && health.checks.checkpointer;

    res.status(isHealthy ? 200 : 503).json(health);
  });

  // Ready check endpoint
  app.get('/ready', async (req: Request, res: Response) => {
    const isReady = mongoose.connection.readyState === 1;
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/api/chat', authenticateJWT, chatRouter);

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      service: 'chat-service',
      version: '1.0.0',
      description: 'LangChain + LangGraph based chat microservice',
      endpoints: {
        health: '/health',
        ready: '/ready',
        api: '/api/chat',
        websocket: '/ws',
      },
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Express error handler', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
      ...(config.APP_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
}

/**
 * Connect to MongoDB
 */
export async function connectDatabase(): Promise<void> {
  try {
    logger.info('📦 Connecting to MongoDB...', {
      uri: config.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@'),
    });

    await mongoose.connect(config.MONGODB_URI);

    logger.info('✅ MongoDB connected successfully');

    mongoose.connection.on('error', (error) => {
      logger.error('❌ MongoDB connection error', { error });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

  } catch (error: any) {
    logger.error('❌ Failed to connect to MongoDB', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info('✅ MongoDB connection closed');
  } catch (error: any) {
    logger.error('❌ Failed to close MongoDB connection', { error });
  }
}
