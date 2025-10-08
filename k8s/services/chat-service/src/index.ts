import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import config from './config/config';
import { connectToDatabase } from './lib/mongodb';
import { WebSocketService } from './services/websocketService';
import chatRoutes from './routes/chat';

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'chat-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness check endpoint
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB not connected');
    }

    res.json({
      status: 'ready',
      service: 'chat-service',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      service: 'chat-service',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API Routes
app.use('/api/chat', chatRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Chat Service',
    version: '1.0.0',
    description: 'Chat Service microservice with WebSocket support',
    endpoints: {
      health: '/health',
      ready: '/ready',
      chat: '/api/chat',
      websocket: 'ws://localhost:3002/ws'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Close WebSocket server
  wsService.stop();

  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close MongoDB connection
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');

  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Start HTTP server
    const PORT = config.PORT;
    server.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Chat Service running on port ${PORT}`);
      console.log(`🌐 WebSocket server available at ws://localhost:${PORT}/ws`);
      console.log(`📡 HTTP API available at http://localhost:${PORT}/api/chat`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`✅ Ready check: http://localhost:${PORT}/ready`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
