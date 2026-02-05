import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    BedrockRuntimeClient,
    InvokeModelWithResponseStreamCommand,
    InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const PORT = process.env.PORT || 5001;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

// --- Bedrock Client Setup ---
const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

const MODELS = {
    claude35: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    claudeHaiku: "anthropic.claude-3-haiku-20240307-v1:0"
};

const APPROVED_PROD_MODELS = [MODELS.claude35, MODELS.claudeHaiku];

// --- Helpers ---
const validateModel = (modelId: string): string => {
    if (ENV_TYPE === 'PROD' && !APPROVED_PROD_MODELS.includes(modelId)) {
        console.warn(`[Bedrock Text] Blocked model ${modelId} in PROD`);
        return MODELS.claude35;
    }
    return modelId || MODELS.claude35;
};

const normalizeMessages = (messages: any[]) => {
    if (!messages || messages.length === 0) return [];

    const normalized: any[] = [];

    // 1. Ensure it starts with 'user'
    let startIndex = messages.findIndex(m => m.role === 'user');
    if (startIndex === -1) {
        // No user message found, add a dummy one or fail? Let's add a dummy if needed
        normalized.push({ role: 'user', content: [{ type: 'text', text: '...' }] });
        startIndex = 0;
    }

    for (let i = startIndex; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg) continue;

        const role = msg.role === 'user' ? 'user' : 'assistant';
        const content: any[] = [];

        if (msg.content) content.push({ type: 'text', text: msg.content });
        if (msg.images) {
            msg.images.forEach((img: any) => {
                content.push({
                    type: 'image',
                    source: { type: 'base64', media_type: img.mediaType, data: img.data }
                });
            });
        }

        if (content.length === 0) continue; // Skip empty messages

        if (normalized.length > 0 && normalized[normalized.length - 1].role === role) {
            // MERGE consecutive same-role messages
            normalized[normalized.length - 1].content.push(...content);
        } else {
            normalized.push({ role, content });
        }
    }

    return normalized;
};

// --- Middleware ---
// Phase 3: Observability
const logCorrelation = (req: Request, res: Response, next: any) => {
    const correlationId = req.headers['x-correlation-id'] || 'unknown';
    console.log(`[Bedrock Text] Request ${req.method} ${req.path} [${correlationId}]`);
    next();
};
app.use(logCorrelation);

import jwt from 'jsonwebtoken';
import fs from 'fs';

const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || '/run/secrets/jwt_public_key';

const authenticateInternal = (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn(`[Bedrock Text] Missing or invalid Authorization header from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Missing Token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const publicKey = fs.readFileSync(PUBLIC_KEY_PATH); // Cache this in prod?
        const decoded: any = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

        // Scope & Audience Check
        const validAudiences = ['bedrock', 'mfu-bedrock-service'];
        if (!validAudiences.includes(decoded.aud)) throw new Error(`Invalid Audience: ${decoded.aud}`);
        if (!decoded.scope || !decoded.scope.includes('internal:')) throw new Error('Invalid Scope');

        (req as any).user = decoded; // Attach for logging
        next();
    } catch (error: any) {
        console.warn(`[Bedrock Text] Token verification failed: ${error.message}`);
        return res.status(403).json({ error: 'Forbidden: Invalid Token' });
    }
};

app.use(authenticateInternal);

// --- Routes ---

app.post('/api/bedrock/chat', async (req: Request, res: Response) => {
    const { messages, modelId } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    const finalModelId = validateModel(modelId);
    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
    const formattedMessages = normalizeMessages(messages.filter(msg => msg.role !== 'system'));

    if (formattedMessages.length === 0) {
        return res.status(400).json({ error: 'No valid user/assistant messages found after normalization' });
    }

    const stream = req.body.stream !== false;

    try {
        if (stream) {
            // SSE Headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            const command = new InvokeModelWithResponseStreamCommand({
                modelId: finalModelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 4096,
                    temperature: 0.7,
                    system: systemMessage,
                    messages: formattedMessages
                })
            });

            const response = await (client as any).send(command);

            let inputTokens = 0;
            let outputTokens = 0;

            if (response.body) {
                for await (const chunk of response.body) {
                    if (chunk.chunk?.bytes) {
                        const decoded = new TextDecoder().decode(chunk.chunk.bytes);
                        const parsed = JSON.parse(decoded);

                        if (parsed.type === 'message_start' && parsed.message?.usage) {
                            inputTokens = parsed.message.usage.input_tokens || 0;
                        }

                        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                            res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
                        }

                        if (parsed.type === 'message_delta' && parsed.usage) {
                            outputTokens = parsed.usage.output_tokens || 0;
                        }
                    }
                }
            }

            const totalTokens = inputTokens + outputTokens;
            res.write(`data: ${JSON.stringify({
                type: 'usage',
                usage: { input: inputTokens, output: outputTokens, total: totalTokens }
            })}\n\n`);

            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            // Synchronous (Non-streaming)
            const command = new InvokeModelCommand({
                modelId: finalModelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 4096,
                    temperature: 0.7,
                    system: systemMessage,
                    messages: formattedMessages
                })
            });

            const response = await (client as any).send(command);
            const decoded = new TextDecoder().decode(response.body);
            const data = JSON.parse(decoded);

            // Robust Parsing: Claude 3 returns content as an array of blocks
            let contentText = '';
            if (Array.isArray(data.content)) {
                contentText = data.content
                    .filter((block: any) => block.type === 'text')
                    .map((block: any) => block.text)
                    .join('');
            } else if (typeof data.content === 'string') {
                contentText = data.content;
            }

            const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
            console.log(`[Bedrock Text] Sync Success [${finalModelId}] Tokens: ${usage.input_tokens + usage.output_tokens}`);

            res.json({
                success: true,
                content: contentText,
                usage: {
                    input: usage.input_tokens,
                    output: usage.output_tokens,
                    total: usage.input_tokens + usage.output_tokens
                }
            });
        }
    } catch (e: any) {
        console.error('[Bedrock Text] Chat error:', e.message);
        if (stream) {
            if (!res.headersSent) res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ success: false, error: e.message });
        }
    }
});

// List Models
app.get('/api/bedrock/models', (req, res) => {
    res.json({
        models: [MODELS.claude35, MODELS.claudeHaiku],
        environment: ENV_TYPE
    });
});

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'bedrock-text' }));

app.listen(PORT, () => console.log(`[Bedrock Text] Running on ${PORT}`));
