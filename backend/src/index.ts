/**
 * MFULearnAI Backend — Main Entry Point
 *
 * Express + Socket.IO monolith serving:
 *   /auth/*  — Authentication (login, SSO, SAML, refresh)
 *   /api/*   — Main REST API (chat, knowledge, users, prompts, logs, tools, keys)
 *   /v1/*    — OpenAI-compatible API surface
 *   /health  — Health check
 *   /admin/queues — Bull Board dashboard
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

// Internal modules
import { connectDB } from './config/db';
import { configureSaml } from './auth/SamlStrategy';
import { setupSocketIO } from './socket';
import { ContextService } from './services/ContextService';
import { queueService } from './services/QueueService';
import { initKnowledgeConfig } from './knowledge/init';
import { knowledgeQueue } from './knowledge/queue';
import { mcpManager } from './mcp/McpManager';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import apiRoutes from './routes';
import v1Routes from './routes/v1';

// ─── Bootstrap ──────────────────────────────────────────────
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8080;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

// Trust reverse proxy (nginx)
app.set('trust proxy', 1);

// ─── Database ───────────────────────────────────────────────
connectDB();

// ─── Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(cors({
    origin: ENV_TYPE === 'PROD'
        ? (process.env.CORS_ORIGIN || 'https://mfulearnai.mfu.ac.th')
        : true,
    credentials: true
}));

app.use(passport.initialize());
configureSaml();

// Correlation ID propagation
app.use((req, res, next) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    res.setHeader('x-correlation-id', correlationId);
    req.headers['x-correlation-id'] = correlationId;

    ContextService.run({ correlationId }, () => {
        next();
    });
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/v1', v1Routes);

// Health Check
app.get('/health', (_req, res) => res.json({
    status: 'ok',
    service: 'orchestrator',
    environment: ENV_TYPE,
}));

// ─── Bull Board (Queue Dashboard) ──────────────────────────
const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: [
        new BullMQAdapter(queueService.ocrQueue),
        new BullMQAdapter(knowledgeQueue),
    ],
    serverAdapter: bullBoardAdapter,
});

app.use('/admin/queues', bullBoardAdapter.getRouter());

// ─── Knowledge Service Init ────────────────────────────────
initKnowledgeConfig();

// ─── Error Handling (must be after all routes) ─────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Socket.IO ─────────────────────────────────────────────
const io = setupSocketIO(httpServer);

// ─── Process-Level Error Handlers ──────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    // Give time for logging, then exit
    setTimeout(() => process.exit(1), 1000);
});

// ─── Start Server ──────────────────────────────────────────
httpServer.listen(PORT, async () => {
    console.log(`[Orchestrator] Server running on port ${PORT} (${ENV_TYPE})`);
    console.log(`[Orchestrator] Bull Board: http://localhost:${PORT}/admin/queues`);

    // Initialize MCP persistent connections
    await mcpManager.init();
});
