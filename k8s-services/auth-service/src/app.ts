import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import authRouter from './routes/auth';
import { connectDB } from './lib/mongodb';
import config from './config/config';

dotenv.config();

const app = express();

// Middleware
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

// Passport serialization (required for SAML)
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// Routes
app.use('/api/auth', authRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'MFULearnAI Auth Service',
    version: '1.0.0',
    endpoints: [
      'GET /health',
      'POST /api/auth/admin/login',
      'GET /api/auth/login/saml',
      'POST /api/auth/saml/callback',
      'GET /api/auth/saml/callback',
      'GET /api/auth/metadata',
      'GET /api/auth/me',
      'POST /api/auth/refresh',
      'GET /api/auth/logout',
      'GET /api/auth/logout/saml',
      'POST /api/auth/logout/saml/callback',
      'GET /api/auth/logout/saml/callback'
    ]
  });
});

// Error handler middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = config.PORT || 3001;

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Auth Service running on port ${PORT}`);
      console.log(`🔐 Environment: ${config.APP_ENV}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
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
