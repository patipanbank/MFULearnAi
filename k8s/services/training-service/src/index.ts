import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/config';
import { connectDB } from './lib/mongodb';

// Import routes
import trainingRoutes from './routes/training';
import queueRoutes from './routes/queue';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check endpoints
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'training-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    const mongoose = await import('mongoose');
    const isMongoReady = mongoose.default.connection.readyState === 1;

    if (!isMongoReady) {
      res.status(503).json({
        status: 'not ready',
        service: 'training-service',
        mongodb: 'not connected'
      });
      return;
    }

    // Check Redis connection (queue service)
    try {
      const { queueService } = await import('./services/queueService');
      const stats = await queueService.getQueueStats();

      res.status(200).json({
        status: 'ready',
        service: 'training-service',
        mongodb: 'connected',
        redis: 'connected',
        queue: stats,
        timestamp: new Date().toISOString()
      });
    } catch (redisError) {
      res.status(503).json({
        status: 'not ready',
        service: 'training-service',
        mongodb: 'connected',
        redis: 'not connected'
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'not ready',
      service: 'training-service',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/training', trainingRoutes);
app.use('/api/queue', queueRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Training Service',
    version: '1.0.0',
    description: 'Training and Document Processing Microservice',
    endpoints: {
      training: '/api/training',
      queue: '/api/queue',
      health: '/health',
      ready: '/ready'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    service: 'training-service'
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    service: 'training-service'
  });
});

// Initialize and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('MongoDB connected');

    // Initialize queue service (connects to Redis)
    console.log('Initializing queue service...');
    const { queueService } = await import('./services/queueService');
    console.log('Queue service initialized');

    // Start Express server
    const PORT = config.PORT;
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   Training Service Started             ║
╠════════════════════════════════════════╣
║ Port:        ${PORT}                     ║
║ Environment: ${config.NODE_ENV}        ║
║ MongoDB:     Connected                 ║
║ Redis:       Connected                 ║
║ RAG Service: ${config.RAG_SERVICE_URL} ║
║ Storage:     ${config.STORAGE_SERVICE_URL} ║
╚════════════════════════════════════════╝
      `);
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Ready check: http://localhost:${PORT}/ready`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const { disconnectDB } = await import('./lib/mongodb');
  const { queueService } = await import('./services/queueService');
  await queueService.shutdown();
  await disconnectDB();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  const { disconnectDB } = await import('./lib/mongodb');
  const { queueService } = await import('./services/queueService');
  await queueService.shutdown();
  await disconnectDB();
  process.exit(0);
});

// Start the server
startServer();

export default app;
