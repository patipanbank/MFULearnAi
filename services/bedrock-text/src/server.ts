import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    BedrockRuntimeClient,
    InvokeModelWithResponseStreamCommand
} from "@aws-sdk/client-bedrock-runtime";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
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

// --- Routes ---

app.post('/api/bedrock/chat', async (req: Request, res: Response) => {
    const { messages, modelId } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    const finalModelId = validateModel(modelId);

    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        // Format for Claude 3
        const formattedMessages = messages
            .filter(msg => msg.role !== 'system')
            .map(msg => {
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
                if (content.length === 0) return null;
                return { role: msg.role === 'user' ? 'user' : 'assistant', content };
            })
            .filter(Boolean);

        const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';

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

        const response = await client.send(command);

        if (response.body) {
            for await (const chunk of response.body) {
                if (chunk.chunk?.bytes) {
                    const decoded = new TextDecoder().decode(chunk.chunk.bytes);
                    const parsed = JSON.parse(decoded);

                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                        res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
                    }

                    if (parsed.type === 'message_stop') {
                        // Usage metrics could be extracted here if needed
                    }
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (e: any) {
        console.error('[Bedrock Text] Chat error:', e);
        if (!res.headersSent) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
        }
        res.end();
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
