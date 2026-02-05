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

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());

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
