import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Configure Multer for memory storage (files handled in memory before processing)
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 7000;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

// Health Check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'knowledge-service',
        environment: ENV_TYPE
    });
});

app.listen(PORT, () => {
    console.log(`[Knowledge Service] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
