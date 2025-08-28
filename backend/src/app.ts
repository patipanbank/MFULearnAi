import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import agentRouter from './routes/agent';
import bedrockRouter from './routes/bedrock';
import chromaRouter from './routes/chroma';
import embeddingRouter from './routes/embedding';
import uploadRouter from './routes/upload';
import collectionRouter from './routes/collection';
import trainingRouter from './routes/training';
import queueRouter from './routes/queue';
import usageRouter from './routes/usage';
import { WebSocketService } from './services/websocketService';
import { queueService } from './services/queueService';
import { connectDB } from './lib/mongodb';

dotenv.config();

const app = express();

app.use(express.json({ 
  type: ['application/json', 'text/plain'] 
}));
app.use(express.urlencoded({ 
  extended: true,
  type: 'application/x-www-form-urlencoded'
}));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Create API router with global prefix
const apiRouter = express.Router();

// Mount auth routes under API router
apiRouter.use('/auth', authRouter);

// Mount chat routes under API router
apiRouter.use('/chat', chatRouter);

// Mount agent routes under API router
apiRouter.use('/agents', agentRouter);

// Mount bedrock routes under API router
apiRouter.use('/bedrock', bedrockRouter);

// Mount chroma routes under API router
apiRouter.use('/chroma', chromaRouter);

// Mount embedding routes under API router
apiRouter.use('/embedding', embeddingRouter);

// Mount upload routes under API router
apiRouter.use('/upload', uploadRouter);

// Mount collection routes under API router
apiRouter.use('/collections', collectionRouter);

// Mount training routes under API router
apiRouter.use('/training', trainingRouter);

// Mount queue routes under API router
apiRouter.use('/queue', queueRouter);

// Mount usage routes under API router
apiRouter.use('/usage', usageRouter);

// Mount API router under /api prefix
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.send('MFULearnAi Node.js Backend');
});

// Error handler middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 WebSocket server available at ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  // Stop queue service
  await queueService.shutdown();
  
  // Stop WebSocket service
  wsService.stop();
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  
  // Stop queue service
  await queueService.shutdown();
  
  // Stop WebSocket service
  wsService.stop();
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer(); 