import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import bodyParser from 'body-parser';
import compression from 'compression';

// Database connection
import { connectDB } from './lib/mongodb';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes - Refactored
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';

// Routes - All refactored
import statsRoutes from './routes/stats';
import departmentRoutes from './routes/department';
import usageRoutes from './routes/usage';
import modelsRoutes from './routes/models';
import embeddingRoutes from './routes/embedding';
import trainingRoutes from './routes/training';

// WebSocket server
import './websocket/ChatWebSocket';

/**
 * Create and configure Express application
 */
function createApp(): Express {
  const app = express();

  // Connect to MongoDB
  connectDB();

  // CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://mfulearnai.ac.th', 'http://mfulearnai.ac.th', 'https://mfulearnai.mfu.ac.th', 'http://mfulearnai.mfu.ac.th'];
  console.log('Allowed origins:', allowedOrigins);

  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error('Not allowed by CORS'), false);
      }

      return callback(null, true);
    },
    credentials: true,
  }));

  // Body parser configuration
  const bodyLimit = '1000mb';
  app.use(bodyParser.json({ limit: bodyLimit }));
  app.use(bodyParser.urlencoded({ limit: bodyLimit, extended: true }));

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // Request timeout (24 hours for long operations)
  app.use((req, res, next) => {
    res.setTimeout(24 * 60 * 60 * 1000);
    next();
  });

  // Compression (skip for SSE endpoints)
  app.use((req, res, next) => {
    if (req.url.includes('/api/chat') && req.method === 'POST') {
      // Skip compression for chat endpoint (SSE)
      next();
    } else {
      compression()(req, res, next);
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes - Refactored
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/admin', adminRoutes);

  // API Routes - Original (to be refactored)
  app.use('/api/training', trainingRoutes);
  app.use('/api/embed', embeddingRoutes);
  app.use('/api/models', modelsRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/usage', usageRoutes);

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
function startServer(): void {
  const app = createApp();
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server running on port 5001`);
  });
}

// Start the server
startServer();

export { createApp };
