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
import bodyParser from 'body-parser';
import compression from 'compression';
import { WebSocket, WebSocketServer } from 'ws';

const app = express();

// Connect to MongoDB
connectDB();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://mfulearnai.mfu.ac.th'];
console.log('Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // console.log('Request origin:', origin);
    
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

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

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

app.use('/api/auth', authRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/chat', chatRoutes);

// เพิ่มการตั้งค่า timeout
app.use((req, res, next) => {
  res.setTimeout(24 * 60 * 60 * 1000); // 24 hours
  next();
});

// ปิดการใช้งาน compression middleware สำหรับ SSE endpoints
app.use((req, res, next) => {
  if (req.url.includes('/api/chat') && req.method === 'POST') {
    // ข้าม compression สำหรับ chat endpoint
    next();
  } else {
    compression()(req, res, next);
  }
});

const wss = new WebSocketServer({ port: Number(process.env.WS_PORT) || 5001 });

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  
  // เพิ่ม middleware เพื่อแนบ ws กับ request
  app.use((req: any, res, next) => {
    req.ws = ws;
    next();
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 