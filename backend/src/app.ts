import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { connectDB } from './lib/mongodb';
import { connectRedis } from './lib/redis';
import { WebSocketService } from './services/websocketService';

// Import routes
import authRoutes from './routes/auth';
import agentRoutes from './routes/agent';
import chatRoutes from './routes/chat';
import collectionRoutes from './routes/collection';
import chromaRoutes from './routes/chroma';
import bedrockRoutes from './routes/bedrock';
import embeddingRoutes from './routes/embedding';
import uploadRoutes from './routes/upload';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/chroma', chromaRoutes);
app.use('/api/bedrock', bedrockRoutes);
app.use('/api/embedding', embeddingRoutes);
app.use('/api/upload', uploadRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Database connection
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    
    const port = process.env.PORT || 3001;
    const server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
    });

    // Initialize WebSocket service
    const wsService = new WebSocketService(server);
    console.log('✅ WebSocket service initialized');

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export default app; 