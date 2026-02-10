import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseStreamCommand
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

    // Filter out any system messages
    const filtered = messages.filter(m => m && m.role !== 'system');
    if (filtered.length === 0) return [];

    const normalized: any[] = [];

    // 1. Ensure it starts with 'user'
    let startIndex = filtered.findIndex(m => m.role === 'user');
    if (startIndex === -1) {
        normalized.push({ role: 'user', content: [{ text: '...' }] });
        startIndex = 0;
    }

    // Process messages from the first valid starting point
    for (let i = startIndex; i < filtered.length; i++) {
        const msg = filtered[i];
        const role = msg.role === 'user' ? 'user' : 'assistant';
        const content: any[] = [];

        // Handle different content types
        if (typeof msg.content === 'string' && msg.content.trim()) {
            content.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
            // Check for tool_result or tool_use blocks which are valid in Converse
            // Converse expects: { text: string } | { image: ... } | { toolUse: ... } | { toolResult: ... }
            // Our internal format might be slightly different, so map carefully.
            // Internal: { type: 'text', text: '...' } -> Converse: { text: '...' }
            // Internal: { type: 'tool_use', ... } -> Converse: { toolUse: ... }
            // Internal: { type: 'tool_result', ... } -> Converse: { toolResult: ... }

            msg.content.forEach((block: any) => {
                if (block.type === 'text') content.push({ text: block.text });
                else if (block.type === 'image') content.push({ image: block.source }); // Check format!
                else if (block.type === 'tool_use') {
                    content.push({
                        toolUse: {
                            toolUseId: block.id || block.toolUseId,
                            name: block.name,
                            input: block.input
                        }
                    });
                }
                else if (block.type === 'tool_result') {
                    content.push({
                        toolResult: {
                            toolUseId: block.toolUseId,
                            content: block.content // Expects [{ json: ... }]
                        }
                    });
                }
            });
        }
        else if (msg.content && typeof msg.content === 'object' && msg.content.text) {
            // Handle raw object case
            content.push({ text: msg.content.text });
        }

        // Add image content if present as property (legacy)
        if (msg.images) {
            msg.images.forEach((img: any) => {
                content.push({
                    image: { format: img.mediaType.split('/')[1], source: { bytes: Buffer.from(img.data, 'base64') } }
                });
            });
        }

        if (content.length === 0) continue;

        // Merge consecutive messages logic (Converse requires strict alternation)
        if (normalized.length > 0 && normalized[normalized.length - 1].role === role) {
            normalized[normalized.length - 1].content.push(...content);
        } else {
            normalized.push({ role, content });
        }
    }

    return normalized;
};

// --- Middleware ---
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
        return res.status(401).json({ error: 'Unauthorized: Missing Token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const publicKey = fs.readFileSync(PUBLIC_KEY_PATH);
        const decoded: any = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

        const validAudiences = ['bedrock', 'mfu-bedrock-service'];
        if (!validAudiences.includes(decoded.aud)) throw new Error(`Invalid Audience: ${decoded.aud}`);
        if (!decoded.scope || !decoded.scope.includes('internal:')) throw new Error('Invalid Scope');

        (req as any).user = decoded;
        next();
    } catch (error: any) {
        console.warn(`[Bedrock Text] Token verification failed: ${error.message}`);
        return res.status(403).json({ error: 'Forbidden: Invalid Token' });
    }
};

app.use(authenticateInternal);

// --- Routes ---

app.post('/api/bedrock/chat', async (req: Request, res: Response) => {
    const { messages, modelId, toolConfig } = req.body;

    console.log(`[Bedrock Text] Incoming Chat Request: ${messages?.length} messages. Tools: ${toolConfig ? 'YES' : 'NO'}`);
    if (toolConfig) {
        console.log(`[Bedrock Text] Tool Config:`, JSON.stringify(toolConfig).substring(0, 200) + '...');
    }

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    const finalModelId = validateModel(modelId);

    // Extract System Prompt for Converse API
    const systemContent = messages.find(msg => msg.role === 'system')?.content;
    const system = systemContent ? [{ text: systemContent }] : undefined;

    // Normalize for Converse
    const formattedMessages = normalizeMessages(messages.filter(msg => msg.role !== 'system'));

    if (formattedMessages.length === 0) {
        return res.status(400).json({ error: 'No valid user/assistant messages found after normalization' });
    }

    const stream = req.body.stream !== false;

    try {
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const command = new ConverseStreamCommand({
                modelId: finalModelId,
                messages: formattedMessages,
                system,
                inferenceConfig: { maxTokens: 4096, temperature: 0.5 },
                toolConfig // Pass tools if present
            });

            const response = await client.send(command);

            if (response.stream) {
                for await (const chunk of response.stream) {
                    if (chunk.contentBlockDelta && chunk.contentBlockDelta.delta?.text) {
                        res.write(`data: ${JSON.stringify({ text: chunk.contentBlockDelta.delta.text })}\n\n`);
                    }
                    if (chunk.metadata) {
                        const usage = chunk.metadata.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
                        res.write(`data: ${JSON.stringify({
                            type: 'usage',
                            usage: { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
                        })}\n\n`);
                    }
                }
            }
            res.write('data: [DONE]\n\n');
            res.end();

        } else {
            // Synchronous (Agent Usage)
            const command = new ConverseCommand({
                modelId: finalModelId,
                messages: formattedMessages,
                system,
                inferenceConfig: { maxTokens: 4096, temperature: 0.5 },
                toolConfig // Pass tools!
            });

            console.log(`[Bedrock Text] Sending ConverseCommand to ${finalModelId}`);
            const response = await client.send(command);

            const outputMessage = response.output?.message;
            const stopReason = response.stopReason;
            const usage = response.usage || { inputTokens: 0, outputTokens: 0 };

            console.log(`[Bedrock Text] Converse Success. StopReason: ${stopReason}`);

            // Map Converse Response Content to AgentWorkflow Compatible Format
            let content: any = [];
            if (outputMessage?.content) {
                content = outputMessage.content.map((block: any) => {
                    if (block.text) return { type: 'text', text: block.text };
                    if (block.toolUse) return {
                        type: 'tool_use',
                        id: block.toolUse.toolUseId,
                        name: block.toolUse.name,
                        input: block.toolUse.input,
                        toolUseId: block.toolUse.toolUseId
                    };
                    return block;
                });
            }

            // Return JSON compatible with AgentWorkflow's parsing expectations
            // AgentWorkflow expects { success: true, content: string|array, ... }
            // We return the content array directly.

            res.json({
                success: true,
                content: content,
                stopReason: stopReason,
                usage: {
                    input: usage.inputTokens,
                    output: usage.outputTokens,
                    total: (usage.inputTokens || 0) + (usage.outputTokens || 0)
                }
            });
        }
    } catch (e: any) {
        console.error('[Bedrock Text] Chat error:', e);
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
