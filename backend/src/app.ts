import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './lib/mongodb';
import { connectRedis } from './lib/redis';
import { WebSocketService } from './services/websocketService';
import { createRateLimiters } from './middleware/rateLimit';
import logger from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import agentRoutes from './routes/agent';
import chatRoutes from './routes/chat';
import collectionRoutes from './routes/collection';
import embeddingRoutes from './routes/embedding';
import uploadRoutes from './routes/upload';
import bedrockRoutes from './routes/bedrock';
import chromaRoutes from './routes/chroma';
import analyticsRoutes from './routes/analytics';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create rate limiters
const rateLimiters = createRateLimiters();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply general rate limiting
app.use(rateLimiters.general);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes with specific rate limiting
app.use('/api/auth', rateLimiters.auth, authRoutes);
app.use('/api/agents', rateLimiters.agent, agentRoutes);
app.use('/api/chat', rateLimiters.chat, chatRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/embeddings', embeddingRoutes);
app.use('/api/upload', rateLimiters.upload, uploadRoutes);
app.use('/api/bedrock', bedrockRoutes);
app.use('/api/chroma', chromaRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Initialize server
const server = app.listen(PORT, async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('Connected to MongoDB');

    // Connect to Redis
    await connectRedis();
    logger.info('Connected to Redis');

    // Initialize WebSocket service
    const wsService = new WebSocketService(server);
    logger.info('WebSocket service initialized');

    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app; 