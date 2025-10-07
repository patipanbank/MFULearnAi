import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import departmentRouter from './routes/department';
import { connectDB, disconnectDB } from './lib/mongodb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'department-service',
    timestamp: new Date().toISOString()
  });
});

// Readiness check endpoint
app.get('/ready', async (req: Request, res: Response) => {
  try {
    const mongoose = await import('mongoose');
    if (mongoose.default.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'not ready',
        reason: 'Database not connected'
      });
    }
    res.json({
      status: 'ready',
      service: 'department-service'
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: String(error)
    });
  }
});

// Mount department routes
app.use('/api/departments', departmentRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'department-service',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start listening
    const server = app.listen(PORT, () => {
      console.log(`🚀 Department Service listening on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`✅ Ready check: http://localhost:${PORT}/ready`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('HTTP server closed');

        try {
          await disconnectDB();
          console.log('Database connections closed');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
