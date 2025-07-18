import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/config';
import { connectDB } from './lib/mongodb';

// Import routes
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import agentRoutes from './routes/agent';
import bedrockRoutes from './routes/bedrock';
import queueRoutes from './routes/queue';

// Import workers
import './workers/chatWorker';
import './workers/agentWorker';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/bedrock', bedrockRoutes);
app.use('/api/queue', queueRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');
    
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 