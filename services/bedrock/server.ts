import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { bedrockService } from './bedrockClient';
import { ChatMessage } from '../../shared/types';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const PORT = process.env.PORT || 5000;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST'; // 'TEST' (MFULearnAI) or 'PROD' (DinDinAI)

// Middleware to enforce model policy
const enforceModelPolicy = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestedModel = req.body.modelId;

    if (ENV_TYPE === 'PROD') {
        // In Production (DinDinAI), only approved models are allowed
        // For now, we force the approved model regardless of request
        if (requestedModel && requestedModel !== bedrockService.models.claude35) {
            console.warn(`[Policy] Blocked request for model ${requestedModel} in PROD environment.`);
        }
        req.body.modelId = bedrockService.models.claude35;
    }
    // In TEST, we allow the requested model or default
    next();
};

app.post('/api/bedrock/chat', enforceModelPolicy, async (req, res) => {
    const { messages, modelId } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const stream = bedrockService.chat(messages, modelId);

        for await (const chunk of stream) {
            // Send chunk as SSE data
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }

        // Send usage stats at the end
        const usage = bedrockService.getLastTokenUsage();
        res.write(`data: ${JSON.stringify({ type: 'usage', usage })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error: any) {
        console.error('Chat endpoint error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

app.post('/api/bedrock/image', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const imageBase64 = await bedrockService.generateImage(prompt);
        res.json({ success: true, image: imageBase64 });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'bedrock-gateway',
        env: ENV_TYPE,
        policy: ENV_TYPE === 'PROD' ? 'STRICT' : 'OPEN'
    });
});

app.listen(PORT, () => {
    console.log(`Bedrock Gateway running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
