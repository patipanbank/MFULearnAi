import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload';
import config from './config/config';
import { storageService } from './services/storageService';

dotenv.config();

const app = express();
const PORT = config.PORT || 3006;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/upload', uploadRouter);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'storage-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const s3Ready = await storageService.healthCheck();
    if (s3Ready) {
      res.json({
        status: 'ready',
        storage: 'connected'
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        storage: 'disconnected'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      storage: 'error'
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    service: 'Storage Service',
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
    // Initialize storage service
    await storageService.ensureBucketExists();

    app.listen(PORT, () => {
      console.log(`🚀 Storage Service running on port ${PORT}`);
      console.log(`📊 Environment: ${config.NODE_ENV}`);
      console.log(`☁️ S3 Endpoint: ${config.S3_ENDPOINT}`);
      console.log(`📦 S3 Bucket: ${config.S3_BUCKET}`);
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
