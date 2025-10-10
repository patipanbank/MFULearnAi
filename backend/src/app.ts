import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import authRouter from './routes/authRoutes';
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

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  // Close HTTP server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');

  // Close HTTP server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer(); 