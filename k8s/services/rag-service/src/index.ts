import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/config';
import { connectDB } from './lib/mongodb';

// Import routes
import chromaRoutes from './routes/chroma';
import embeddingRoutes from './routes/embedding';
import collectionRoutes from './routes/collection';

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
    service: 'rag-service',
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
        service: 'rag-service',
        mongodb: 'not connected'
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      service: 'rag-service',
      mongodb: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'not ready',
      service: 'rag-service',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/chroma', chromaRoutes);
app.use('/api/embedding', embeddingRoutes);
app.use('/api/collections', collectionRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'RAG Service',
    version: '1.0.0',
    description: 'Retrieval Augmented Generation Microservice',
    endpoints: {
      chroma: '/api/chroma',
      embedding: '/api/embedding',
      collections: '/api/collections',
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
    service: 'rag-service'
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    service: 'rag-service'
  });
});

// Initialize and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected');

    // Start Express server
    const PORT = config.PORT;
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║     RAG Service Started                ║
╠════════════════════════════════════════╣
║ Port:        ${PORT}                     ║
║ Environment: ${config.NODE_ENV}        ║
║ MongoDB:     Connected                 ║
║ ChromaDB:    ${config.CHROMA_URL}      ║
║ Bedrock:     ${config.BEDROCK_SERVICE_URL} ║
╚════════════════════════════════════════╝
      `);
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 Ready check: http://localhost:${PORT}/ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const { disconnectDB } = await import('./lib/mongodb');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  const { disconnectDB } = await import('./lib/mongodb');
  await disconnectDB();
  process.exit(0);
});

// Start the server
startServer();

export default app;
