import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import routes from './routes';
import { setupSocketIO } from './socket';
import passport from 'passport';
import { configureSaml } from './auth/SamlStrategy';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8080;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const RATE_LIMIT = ENV_TYPE === 'PROD' ? 30 : 100;

// Connect to Database
connectDB();

import { v4 as uuidv4 } from 'uuid';
import { ContextService } from './services/ContextService';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors({
    origin: ENV_TYPE === 'PROD'
        ? (process.env.CORS_ORIGIN || 'https://mfulearnai.mfu.ac.th')
        : true, // Allow all in TEST/DEV
    credentials: true
}));

app.use(passport.initialize());
configureSaml();


// Observability Middleware
app.use((req, res, next) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    // Propagate back to response
    res.setHeader('x-correlation-id', correlationId);
    // Ensure downstream controllers can see it
    req.headers['x-correlation-id'] = correlationId;

    ContextService.run({ correlationId }, () => {
        next();
    });
});

// Routes
import authRoutes from './routes/auth';
app.use('/auth', authRoutes);

app.use('/api', routes);

// Health Check
app.get('/health', (req, res) => res.json({
    status: 'ok',
    service: 'orchestrator',
    environment: ENV_TYPE,
    rateLimit: RATE_LIMIT
}));

// Bull Board
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queueService } from './services/QueueService';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

import { initKnowledgeConfig } from './knowledge/init';
import { knowledgeQueue } from './knowledge/queue';

// ... (after connectDB)

createBullBoard({
    queues: [
        new BullMQAdapter(queueService.ocrQueue),
        new BullMQAdapter(knowledgeQueue)
    ],
    serverAdapter: serverAdapter,
});

// Initialize Knowledge Service
initKnowledgeConfig();

app.use('/admin/queues', serverAdapter.getRouter());

// Initialize Socket.IO (must be after app setup, before listen)
const io = setupSocketIO(httpServer);

// Start Server — use httpServer instead of app.listen for Socket.IO
httpServer.listen(PORT, () => {
    console.log(`[Orchestrator] Server running on port ${PORT} (${ENV_TYPE})`);
    console.log(`[Orchestrator] Bull Board available at http://localhost:${PORT}/admin/queues`);
});

