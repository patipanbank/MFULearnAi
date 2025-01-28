import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import { connectDB } from './lib/mongodb';
import authRoutes from './routes/auth';
import trainingRoutes from './routes/training';
import chatRoutes from './routes/chat';

const app = express();

// Connect to MongoDB
connectDB();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://mfulearnai.mfu.ac.th'];
console.log('Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    console.log('Request origin:', origin);
    
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('Not allowed by CORS'), false);
    }

    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// เพิ่ม timeout settings
const TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

app.use((req, res, next) => {
  // Set timeout for all requests
  req.setTimeout(TIMEOUT);
  res.setTimeout(TIMEOUT, () => {
    res.status(504).json({ error: 'Request timeout' });
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/chat', (req, res, next) => {
  req.setTimeout(TIMEOUT);
  res.setTimeout(TIMEOUT);
  next();
}, chatRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 