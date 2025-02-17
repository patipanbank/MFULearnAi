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
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

// เก็บ WebSocket connections
export const wsClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  wsClients.add(ws as any);

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    wsClients.delete(ws as any);
  });
});

const PORT = process.env.PORT || 5000;
const WS_PORT = process.env.WS_PORT || 5001;

server.listen(WS_PORT, () => {
  console.log(`WebSocket server running on port ${WS_PORT}`);
});

app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
}); 