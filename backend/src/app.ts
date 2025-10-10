import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/config';
import { connectDB } from './lib/mongodb';
import { redis } from './lib/redis';

// Import routes
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';

const app: Application = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOrigins = config.ALLOWED_ORIGINS ? config.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.APP_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', async (req, res) => {
  try {
    const redisHealthy = await redis.ping() === 'PONG';

    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.APP_ENV,
      services: {
        database: 'connected',
        redis: redisHealthy ? 'connected' : 'disconnected',
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MFU Learn AI API - Production Ready',
    version: '2.0.0',
    environment: config.APP_ENV,
  });
});

// API Routes
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/admin', adminRoutes);

// Mount API router
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();

    try {
      const redisHealthy = await redis.ping();
      if (redisHealthy !== 'PONG') {
        console.warn('⚠️  Redis connection test failed, but continuing...');
      }
    } catch (error) {
      console.warn('⚠️  Redis connection test failed, but continuing...');
    }

    const PORT = config.PORT;
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 MFU Learn AI Backend Server - Production Ready');
      console.log('='.repeat(60));
      console.log(`📍 Environment: ${config.APP_ENV}`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await redis.quit();
    console.log('✅ Redis disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();

export default app;
