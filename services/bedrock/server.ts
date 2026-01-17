import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { bedrockService } from './bedrockClient';
import { ChatMessage } from '../../shared/types';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const PORT = process.env.PORT || 5000;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

// Request timeout middleware
const timeout = (ms: number) => (req: Request, res: Response, next: any) => {
    res.setTimeout(ms, () => {
        console.error('[Bedrock] Request timeout');
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout' });
        }
    });
    next();
};

// Model policy middleware
const enforceModelPolicy = (req: Request, res: Response, next: any) => {
    const requestedModel = req.body.modelId;

    if (ENV_TYPE === 'PROD' && requestedModel) {
        if (!bedrockService.isModelApproved(requestedModel)) {
            console.warn(`[Bedrock] Policy blocked model ${requestedModel} in PROD`);
            req.body.modelId = undefined; // Will use default
        }
    }
    next();
};

// Chat endpoint
app.post('/api/bedrock/chat', timeout(120000), enforceModelPolicy, async (req: Request, res: Response) => {
    const { messages, modelId } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        const stream = bedrockService.chat(messages as ChatMessage[], modelId);

        for await (const chunk of stream) {
            if (res.writableEnded) break;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }

        // Send usage stats
        const usage = bedrockService.getLastTokenUsage();
        res.write(`data: ${JSON.stringify({ type: 'usage', usage })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error: any) {
        console.error('[Bedrock] Chat error:', error);

        const errorResponse = {
            error: error.message || 'Failed to generate response',
            code: error.name || 'UNKNOWN_ERROR',
            retryable: !['ValidationException', 'AccessDeniedException'].includes(error.name)
        };

        if (!res.headersSent) {
            res.write(`event: error\ndata: ${JSON.stringify(errorResponse)}\n\n`);
        }
        res.end();
    }
});

// Image generation endpoint
app.post('/api/bedrock/image', timeout(60000), async (req: Request, res: Response) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const imageBase64 = await bedrockService.generateImage(prompt);
        res.json({ success: true, image: imageBase64 });
    } catch (error: any) {
        console.error('[Bedrock] Image error:', error);
        res.status(500).json({
            error: error.message,
            retryable: true
        });
    }
});



// Embedding endpoint
app.post('/api/bedrock/embeddings', timeout(90000), async (req: Request, res: Response) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    try {
        const embedding = await bedrockService.generateEmbedding(text);
        res.json({ success: true, embedding });
    } catch (error: any) {
        console.error('[Bedrock] Embedding error:', error);
        res.status(500).json({
            error: error.message,
            retryable: true
        });
    }
});

// Get available models
app.get('/api/bedrock/models', (req: Request, res: Response) => {
    res.json({
        models: bedrockService.getAvailableModels(),
        environment: ENV_TYPE,
        policy: ENV_TYPE === 'PROD' ? 'STRICT' : 'OPEN'
    });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'bedrock-gateway',
        environment: ENV_TYPE,
        policy: ENV_TYPE === 'PROD' ? 'STRICT' : 'OPEN',
        availableModels: bedrockService.getAvailableModels().length
    });
});

app.listen(PORT, () => {
    console.log(`[Bedrock Gateway] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
