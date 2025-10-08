import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './lib/mongodb';
import departmentRouter from './routes/department';
import config from './config/config';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = config.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/departments', departmentRouter);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'department-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  if (dbReady) {
    res.json({
      status: 'ready',
      database: 'connected'
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected'
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    service: 'Department Service',
    version: '1.0.0',
    status: 'running'
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Department Service running on port ${PORT}`);
      console.log(`📊 Environment: ${config.NODE_ENV}`);
      console.log(`💾 MongoDB: Connected`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();
