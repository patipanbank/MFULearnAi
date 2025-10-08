import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/config';
import { configureRoutes } from './routes';

// ============================================
// EXPRESS APP INITIALIZATION
// ============================================

const app: Application = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API Gateway
    crossOriginEmbedderPolicy: false,
  })
);

// CORS - Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  })
);

// ============================================
// LOGGING MIDDLEWARE
// ============================================

// Morgan - HTTP request logger
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Custom request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================

// Parse JSON bodies (limit size to prevent abuse)
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// API ROUTES & PROXIES
// ============================================

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'MFULearnAI API Gateway',
    version: '1.0.0',
    status: 'running',
    environment: config.env,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      departments: '/api/departments',
      chat: '/api/chat',
      agents: '/api/agents',
      chroma: '/api/chroma',
      embedding: '/api/embedding',
      collections: '/api/collections',
      training: '/api/training',
      queue: '/api/queue',
      upload: '/api/upload',
      files: '/api/files',
      bedrock: '/api/bedrock',
      websocket: '/ws',
    },
    documentation: 'https://docs.mfulearnai.example.com',
  });
});

// Configure all proxy routes
configureRoutes(app);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);

  // Check if headers have already been sent
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message:
      config.env === 'development'
        ? err.message
        : 'An unexpected error occurred. Please try again later.',
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const startServer = (): void => {
  const port = config.port;

  const server = app.listen(port, () => {
    console.log('='.repeat(60));
    console.log('🚀 MFULearnAI API Gateway');
    console.log('='.repeat(60));
    console.log(`Environment: ${config.env}`);
    console.log(`Port: ${port}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    console.log('Connected Services:');
    console.log(`  Auth Service:       ${config.services.auth}`);
    console.log(`  Department Service: ${config.services.department}`);
    console.log(`  Chat Service:       ${config.services.chat}`);
    console.log(`  Agent Service:      ${config.services.agent}`);
    console.log(`  RAG Service:        ${config.services.rag}`);
    console.log(`  Training Service:   ${config.services.training}`);
    console.log(`  Storage Service:    ${config.services.storage}`);
    console.log(`  Bedrock Gateway:    ${config.services.bedrock}`);
    console.log('='.repeat(60));
    console.log(`Server is running on http://localhost:${port}`);
    console.log('='.repeat(60));
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string): void => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close(() => {
      console.log('Server closed. All connections terminated.');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    console.error('Unhandled Rejection:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
};

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
