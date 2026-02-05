import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const RATE_LIMIT = ENV_TYPE === 'PROD' ? 30 : 100;

// Connect to Database
connectDB();

import { v4 as uuidv4 } from 'uuid';
import { ContextService } from './services/ContextService';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Observability Middleware
app.use((req, res, next) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    // Propagate back to response
    res.setHeader('x-correlation-id', correlationId);

    ContextService.run({ correlationId }, () => {
        next();
    });
});

// Routes
app.use('/api', routes);

// Health Check
app.get('/health', (req, res) => res.json({
    status: 'ok',
    service: 'orchestrator',
    environment: ENV_TYPE,
    rateLimit: RATE_LIMIT
}));

// Start Server
app.listen(PORT, () => {
    console.log(`[Orchestrator] Server running on port ${PORT} (${ENV_TYPE})`);
});
