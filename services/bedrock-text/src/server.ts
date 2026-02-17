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

// --- Enhancement 3: Guardrails Config ---
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID || '';
const GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT';

// --- Enhancement 1: Prompt Caching (OPT-IN) ---
// Set BEDROCK_ENABLE_CACHE=true to enable. Not all regions/models support this.
const ENABLE_PROMPT_CACHE = process.env.BEDROCK_ENABLE_CACHE === 'true';
const CACHE_SUPPORTED_MODELS = [
    'anthropic.claude-3-5-sonnet-20240620-v1:0',
    'anthropic.claude-3-haiku-20240307-v1:0'
];

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
                else if (block.type === 'image') content.push({ image: block.source });
                // Enhancement 2: Native Document Support
                else if (block.type === 'document') {
                    const docBytes = typeof block.data === 'string'
                        ? Buffer.from(block.data, 'base64')
                        : block.data;
                    console.log(`[Bedrock Text] Document block found: name="${block.name}", format="${block.format}", dataSize=${docBytes?.length || 0} bytes`);
                    content.push({
                        document: {
                            format: block.format || 'pdf',
                            name: block.name || 'document',
                            source: { bytes: docBytes }
                        }
                    });
                }
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

        // Enhancement 5: Rich Multi-modal History - Native file attachments
        if (msg.native_files) {
            msg.native_files.forEach((file: any) => {
                content.push({
                    document: {
                        format: file.format || 'pdf',
                        name: file.name || 'document',
                        source: {
                            bytes: typeof file.data === 'string'
                                ? Buffer.from(file.data, 'base64')
                                : file.data
                        }
                    }
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
    const { messages, modelId, toolConfig, guardrailConfig: reqGuardrailConfig } = req.body;

    console.log(`[Bedrock Text] Incoming Chat Request: ${messages?.length} messages. Tools: ${toolConfig ? 'YES' : 'NO'}`);
    if (toolConfig) {
        console.log(`[Bedrock Text] Tool Config:`, JSON.stringify(toolConfig).substring(0, 200) + '...');
    }

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    const finalModelId = validateModel(modelId);

    // Enhancement 4: Multi-Block System Prompts
    // System prompt can now be a string OR an array of { text: string } blocks
    const systemMsg = messages.find(msg => msg.role === 'system');
    let system: any[] | undefined;
    if (systemMsg) {
        if (Array.isArray(systemMsg.content)) {
            // Already structured as blocks: [{ text: '...' }, { text: '...' }]
            system = systemMsg.content.map((block: any) => (
                typeof block === 'string' ? { text: block } : block
            ));
        } else if (typeof systemMsg.content === 'string') {
            system = [{ text: systemMsg.content }];
        }
    }

    // Enhancement 3: Guardrails - merge env config with request config
    let guardrailConfig: any = undefined;
    if (reqGuardrailConfig) {
        guardrailConfig = reqGuardrailConfig;
    } else if (GUARDRAIL_ID) {
        guardrailConfig = {
            guardrailIdentifier: GUARDRAIL_ID,
            guardrailVersion: GUARDRAIL_VERSION
        };
    }

    // Normalize for Converse
    const formattedMessages = normalizeMessages(messages.filter(msg => msg.role !== 'system'));

    if (formattedMessages.length === 0) {
        return res.status(400).json({ error: 'No valid user/assistant messages found after normalization' });
    }

    const stream = req.body.stream !== false;

    // Enhancement 1: Prompt Caching (OPT-IN only)
    // Only enable if BEDROCK_ENABLE_CACHE=true AND model supports it
    const enableCaching = ENABLE_PROMPT_CACHE && CACHE_SUPPORTED_MODELS.some(m => finalModelId.includes(m));
    let additionalModelRequestFields: any = undefined;
    if (enableCaching && system && system.length > 0) {
        // Add cache_point to end of system blocks for Anthropic Prompt Caching
        additionalModelRequestFields = {
            anthropic_beta: ['prompt-caching-2024-07-31']
        };
        // Add cachePoint marker after the last system block
        system.push({ cachePoint: { type: 'default' } } as any);
        console.log(`[Bedrock Text] Prompt Caching ENABLED for ${finalModelId}`);
    }

    try {
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const streamCommandInput: any = {
                modelId: finalModelId,
                messages: formattedMessages,
                system,
                inferenceConfig: { maxTokens: 4096, temperature: 0.5 },
                toolConfig
            };
            if (guardrailConfig) streamCommandInput.guardrailConfig = guardrailConfig;
            if (additionalModelRequestFields) streamCommandInput.additionalModelRequestFields = additionalModelRequestFields;

            const command = new ConverseStreamCommand(streamCommandInput);

            const response = await client.send(command);

            if (response.stream) {
                let currentBlockIndex = 0;

                for await (const chunk of response.stream) {
                    // 1. Content Block Start (Tool Use or Text)
                    if (chunk.contentBlockStart) {
                        const start = chunk.contentBlockStart;
                        currentBlockIndex = start.contentBlockIndex || 0;

                        if (start.start?.toolUse) {
                            // Notify client/orchestrator that a tool use block is starting
                            res.write(`data: ${JSON.stringify({
                                type: 'content_block_start',
                                index: currentBlockIndex,
                                toolUse: start.start.toolUse
                            })}\n\n`);
                        }
                    }

                    // 2. Content Block Delta (Text or Tool Input)
                    if (chunk.contentBlockDelta) {
                        const delta = chunk.contentBlockDelta.delta;
                        if (delta?.text) {
                            res.write(`data: ${JSON.stringify({
                                type: 'text_delta',
                                text: delta.text,
                                index: currentBlockIndex // Helpful if multiple blocks
                            })}\n\n`);
                        }
                        if (delta?.toolUse) {
                            res.write(`data: ${JSON.stringify({
                                type: 'input_delta',
                                input: delta.toolUse.input,
                                index: currentBlockIndex
                            })}\n\n`);
                        }
                    }

                    // 3. Message Stop (Stop Reason)
                    if (chunk.messageStop) {
                        const stopReason = chunk.messageStop.stopReason;
                        res.write(`data: ${JSON.stringify({ type: 'message_stop', stopReason })}\n\n`);
                    }

                    // 4. Metadata (Usage)
                    if (chunk.metadata) {
                        const usage = chunk.metadata.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
                        const cacheUsage = (chunk.metadata as any).cacheUsage || null;
                        const usagePayload: any = {
                            type: 'usage',
                            usage: { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
                        };
                        if (cacheUsage) usagePayload.cacheUsage = cacheUsage;
                        res.write(`data: ${JSON.stringify(usagePayload)}\n\n`);
                    }
                }
            }
            res.write('data: [DONE]\n\n');
            res.end();

        } else {
            // Synchronous (Agent Usage)
            const converseInput: any = {
                modelId: finalModelId,
                messages: formattedMessages,
                system,
                inferenceConfig: { maxTokens: 4096, temperature: 0.5 },
                toolConfig
            };
            if (guardrailConfig) converseInput.guardrailConfig = guardrailConfig;
            if (additionalModelRequestFields) converseInput.additionalModelRequestFields = additionalModelRequestFields;

            // Diagnostic: log document blocks in request
            const docBlockCount = formattedMessages.reduce((sum: number, m: any) => {
                if (!Array.isArray(m.content)) return sum;
                return sum + m.content.filter((c: any) => c.document).length;
            }, 0);
            console.log(`[Bedrock Text] Sending ConverseCommand to ${finalModelId}, docBlocks=${docBlockCount}, messageCount=${formattedMessages.length}`);
            if (docBlockCount > 0) {
                formattedMessages.forEach((m: any, idx: number) => {
                    if (!Array.isArray(m.content)) return;
                    m.content.forEach((c: any, cIdx: number) => {
                        if (c.document) {
                            console.log(`[Bedrock Text]   msg[${idx}].content[${cIdx}]: document name="${c.document.name}", format="${c.document.format}", bytesLength=${c.document.source?.bytes?.length || 0}`);
                        }
                    });
                });
            }

            const command = new ConverseCommand(converseInput);
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

            // Enhancement 1: Include cache usage in response
            const cacheUsage = (response as any).cacheUsage || null;

            const responsePayload: any = {
                success: true,
                content: content,
                stopReason: stopReason,
                usage: {
                    input: usage.inputTokens,
                    output: usage.outputTokens,
                    total: (usage.inputTokens || 0) + (usage.outputTokens || 0)
                }
            };
            if (cacheUsage) {
                responsePayload.cacheUsage = cacheUsage;
                console.log(`[Bedrock Text] Cache Usage:`, JSON.stringify(cacheUsage));
            }

            // Enhancement 3: Include guardrail trace if present
            if ((response as any).trace?.guardrail) {
                responsePayload.guardrailTrace = (response as any).trace.guardrail;
                console.log(`[Bedrock Text] Guardrail Trace:`, JSON.stringify((response as any).trace.guardrail).substring(0, 200));
            }

            res.json(responsePayload);
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
