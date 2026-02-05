import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import busboy from 'busboy';
import FormData from 'form-data';
import mongoose from 'mongoose';
import { ChatMessage, ServiceResponse, CanonicalIR, IRBlock } from '../../shared/types';
import { getSystemPrompt, CONTEXT_PROMPTS } from './systemPrompts';
import Prompt from './models/Prompt';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Environment Configuration
const BEDROCK_TEXT_URL = process.env.BEDROCK_TEXT_URL || 'http://localhost:5001/api/bedrock';
const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:6000/api/logs';
const KNOWLEDGE_URL = process.env.KNOWLEDGE_URL || 'http://localhost:7000/api/knowledge';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-chat';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const ENV_TYPE = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';

// Redis Client
const redis = new Redis(REDIS_URL);
redis.on('error', (err) => console.error('[Orchestrator] Redis Error', err));

// MongoDB Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log(`[Orchestrator] Connected to MongoDB (${ENV_TYPE})`))
    .catch(err => console.error('[Orchestrator] MongoDB error:', err));

// Conversation Schema
const ConversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    environment: { type: String, enum: ['TEST', 'PROD'], required: true },
    messages: [{
        role: { type: String, enum: ['user', 'assistant', 'system'] },
        content: String,
        images: [{
            data: String,
            mediaType: String
        }],
        files: [{
            name: String,
            content: String,
            size: Number,
            mediaType: String
        }],
        timestamp: { type: Date, default: Date.now }
    }],
    modelId: String,
    metadata: {
        totalTokens: { type: Number, default: 0 },
        estimatedCost: { type: Number, default: 0 },
        messageCount: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ConversationSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
const Conversation = mongoose.model('Conversation', ConversationSchema);

// --- Logger Helper ---
const logActivity = async (
    level: 'debug' | 'info' | 'warn' | 'error' | 'audit',
    action: string,
    context: any,
    userId?: string
) => {
    try {
        await axios.post(LOGGER_URL, {
            level,
            service: 'orchestrator',
            userId,
            action,
            details: context,
            environment: ENV_TYPE,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Orchestrator] Failed to log:', err);
    }
};

import { authenticateToken } from '../../shared/middleware/auth';

// --- Axios Retry Policy (Phase 2: Reliability) ---
// Retries only on Network Errors or 5xx (Server Errors).
// Does NOT retry 4xx (Client Errors) or non-idempotent unsafe methods (though we mostly use POST for read-heavy RAG, be careful).
axiosRetry(axios, {
    retries: 2,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        // Retry networking errors or 5xx status codes
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ? error.response.status >= 500 : false);
    },
    onRetry: (retryCount, error, requestConfig) => {
        console.warn(`[Orchestrator] Retrying request to ${requestConfig.url} (Attempt ${retryCount}) due to: ${error.message}`);
    }
});

// --- Middleware ---
// Use shared auth middleware
const checkAuth = authenticateToken(JWT_SECRET);
// We use the alias 'checkAuth' to match the signature required by Express


// Rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = ENV_TYPE === 'PROD' ? 30 : 100;
const RATE_WINDOW = 60 * 1000;

const rateLimiter = (req: any, res: Response, next: NextFunction) => {
    const userId = req.user?.userId || req.ip;
    const now = Date.now();

    const userLimit = rateLimits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        rateLimits.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
        return next();
    }

    if (userLimit.count >= RATE_LIMIT) {
        logActivity('warn', 'rate_limit_exceeded', { userId }, userId);
        return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
        });
    }

    userLimit.count++;
    next();
};

// --- RAG Helper ---
// --- RAG Helper ---
async function searchKnowledgeBase(query: string, userContext: any, collectionId?: string): Promise<string> {
    // If collectionId provided, passed it.
    try {
        const payload: any = { query, limit: 3 };
        if (collectionId) payload.collectionId = collectionId;

        // Pass User Context Headers so Knowledge Service can enforce visibility
        const headers: any = {
            'x-user-id': userContext.userId,
            'x-role': userContext.role,
            'x-department': userContext.department || 'General',
            'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-secret-key'
        };

        const response = await axios.post(`${KNOWLEDGE_URL}/search`, payload, { headers });
        console.log(`[Orchestrator] RAG Search for collection ${collectionId || 'default'}: Found ${response.data?.results?.length || 0} hits`);

        if (response.data && response.data.results) {
            const context = response.data.results
                .map((hit: any) => `[Source: ${hit.metadata.source}]\n${hit.content}`)
                .join('\n\n');
            console.log('[Orchestrator] RAG Context Length:', context.length);
            return context;
        }
    } catch (error: any) {
        console.warn('[Orchestrator] Knowledge search failed:', error.message);
        console.warn('[Orchestrator] Payload was:', { query, collectionId });
    }
    return '';
}

// --- Prompt Logic ---
const SYSTEM_PROMPT_KEY_PREFIX = 'system_prompt:';

const getCoreSystemPrompt = async (envType: 'TEST' | 'PROD'): Promise<string> => {
    // 1. Try Cache
    const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}CORE:${envType}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    // 2. Try DB (Find active core prompt for this env)
    // We assume tags contain 'PROD' or 'TEST' or key contains it
    // For simplicity, let's stick to the convention: key must be DINDINAI_PROD or MFULEARNAI_TEST to be auto-picked
    // OR we allow setting one active core prompt globally per type.

    // Better strategy: Find active prompt with type='core' and tag=envType
    // But currently data migration might be empty.

    // Fallback Keys
    const fallbackKey = envType === 'PROD' ? 'DINDINAI_SYSTEM_PROMPT' : 'MFULEARNAI_SYSTEM_PROMPT';

    const promptDoc = await Prompt.findOne({
        type: 'core',
        isActive: true,
        $or: [{ key: fallbackKey }, { tags: envType }]
    });

    if (promptDoc) {
        const content = promptDoc.versions.find(v => v.version === promptDoc.activeVersion)?.content || promptDoc.versions[0]?.content || '';
        await redis.set(cacheKey, content, 'EX', 300); // 5 min cache
        return content;
    }

    // 3. Fallback to File
    return getSystemPrompt(envType);
};

const getScenarioPrompt = async (scenarioId: string, userId: string): Promise<string> => {
    const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}SCENARIO:${scenarioId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const prompt = await Prompt.findOne({ _id: scenarioId }); // Assuming ID is passed, or Key
    if (!prompt) return '';

    // Access Check (Public or Owner)
    if (!prompt.isPublic && prompt.ownerId !== userId) return '';

    const content = prompt.versions.find(v => v.version === prompt.activeVersion)?.content || '';
    if (content) {
        await redis.set(cacheKey, content, 'EX', 300);
    }
    return content;
};

// --- Chat Endpoint (Updated for Multipart & IR) ---
app.post('/api/chat', authenticateToken, rateLimiter, async (req: any, res: Response) => {
    // Check Content-Type for Multipart
    const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

    // Variables to be populated
    let message = '';
    let sessionId = '';
    let modelId = '';
    let collectionId = '';
    let context = '';
    let images: any[] = [];
    let files: any[] = []; // Raw files for logging/history
    let fileParses: CanonicalIR[] = []; // Parsed IRs
    let scenarioId = '';

    const userId = req.user.userId;

    const processRequest = async () => {
        if (!message && (!images || images.length === 0) && (!files || files.length === 0)) {
            return res.status(400).json({ error: 'Message or attachment is required' });
        }

        const actualSessionId = sessionId || `session-${Date.now()}`;

        try {
            logActivity('info', 'chat_request_received', {
                sessionId: actualSessionId,
                messageLength: message?.length || 0,
                modelId,
                fileCount: files?.length || 0
            }, userId);

            // 1. Get History
            const historyKey = `chat:${userId}:${actualSessionId}`;
            const rawHistory = await redis.lrange(historyKey, 0, -1);
            const history: ChatMessage[] = rawHistory
                .map(item => JSON.parse(item))
                .filter(msg => msg.content || msg.images?.length || msg.files?.length);

            // 2. RAG Context (Optional)
            const userContext = { userId: req.user.userId, role: req.user.role, department: req.user.department };
            const ragContext = await searchKnowledgeBase(message || '', userContext, collectionId);
            let ragSystemPrompt = ragContext ? `\n\nHere is some relevant context from the Knowledge Base:\n<context>\n${ragContext}\n</context>\nUse this context to answer the user's question if relevant.` : '';

            // 3. Prepare System Prompt
            const corePrompt = await getCoreSystemPrompt(ENV_TYPE);
            let scenarioPrompt = '';
            if (scenarioId) {
                scenarioPrompt = await getScenarioPrompt(scenarioId, req.user.userId);
                if (scenarioPrompt) scenarioPrompt = `\n\n=== ACT AS FOLLOWS ===\n${scenarioPrompt}`;
            }
            const additionalContext = context && CONTEXT_PROMPTS[context as keyof typeof CONTEXT_PROMPTS] ? `\n\n${CONTEXT_PROMPTS[context as keyof typeof CONTEXT_PROMPTS]}` : '';

            // IR Context Builder
            let fileContextPrompt = '';
            if (fileParses.length > 0) {
                fileContextPrompt += `\n\n=== ATTACHED FILE CONTEXT ===\n`;
                // Iterate IRs
                fileParses.forEach((ir, idx) => {
                    const originalName = files[idx]?.name || `File ${idx + 1}`;
                    fileContextPrompt += `\n[File: ${originalName}]\n`;

                    if (ir.metadata?.warnings?.length) {
                        const warningMsg = ir.metadata.warnings.map(w => w.message).join('; ');
                        fileContextPrompt += `[WARNING: ${warningMsg}]\n`;
                    }

                    if (ir.metadata?.layout === 'multi-column') {
                        fileContextPrompt += `[Hint: Multi-column layout detected. Read blocks accordingly.]\n`;
                    }

                    // Add Blocks (Simple concatenation for now, smart selection later if needed)
                    // HEURISTIC: Limit total tokens? For now, allow up to ~20k chars per file
                    let charCount = 0;
                    const MAX_CHARS = 50000;

                    for (const block of ir.blocks) {
                        if (charCount > MAX_CHARS) {
                            fileContextPrompt += `\n... [Remaining content truncated due to length] ... \n`;
                            break;
                        }

                        let blockText = `\n`;
                        if (block.metadata.page) blockText += `[Page ${block.metadata.page}] `;
                        if (block.metadata.sheet) blockText += `[Sheet: ${block.metadata.sheet}] `;
                        if (block.metadata.title) blockText += `[Section: ${block.metadata.title}] `;

                        // Table handling
                        if (block.type === 'table' && block.table_data) {
                            blockText += `\n${block.content}`;
                        } else {
                            blockText += `\n${block.content}`;
                        }

                        if (block.metadata.confidence && block.metadata.confidence < 0.6) {
                            blockText += ` [Low Confidence]`;
                        }

                        fileContextPrompt += blockText;
                        charCount += blockText.length;
                    }
                });
                fileContextPrompt += `\n\n=== END ATTACHED FILES ===\nIf information is missing or unclear from the files, state that explicitly.`;
            }

            const finalSystemContent = corePrompt + additionalContext + ragSystemPrompt + fileContextPrompt + scenarioPrompt;
            const systemMessage: ChatMessage = { role: 'system', content: finalSystemContent, timestamp: new Date() };

            const currentMessage: ChatMessage = {
                role: 'user',
                content: message || '',
                images: images || [],
                files: files || [],
                timestamp: new Date()
            };

            // Format Bedrock Messages
            const formatMessageForAI = (msg: ChatMessage) => ({
                role: msg.role,
                content: msg.content, // Context is now in SYSTEM prompt, so user content is clean
                images: msg.images
            });

            const messagesToSend = [
                systemMessage,
                ...history.map(formatMessageForAI),
                formatMessageForAI(currentMessage)
            ];

            // 4. SSE Stream
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            const response = await axios({
                method: 'post',
                url: `${BEDROCK_TEXT_URL}/chat`,
                data: { messages: messagesToSend, modelId },
                headers: { 'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-secret-key' },
                responseType: 'stream',
                timeout: 120000
            });

            let fullResponseText = '';
            let tokenUsage = { input: 0, output: 0, total: 0 };

            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.text) fullResponseText += data.text;
                            if (data.type === 'usage' && data.usage) tokenUsage = data.usage;
                        } catch (e) { }
                    }
                }
                res.write(chunk);
            });

            response.data.on('end', async () => {
                res.end();
                // Save History
                const assistantMessage: ChatMessage = { role: 'assistant', content: fullResponseText, timestamp: new Date() };
                await redis.rpush(historyKey, JSON.stringify(currentMessage), JSON.stringify(assistantMessage));
                await redis.ltrim(historyKey, -50, -1);
                await redis.expire(historyKey, 86400);

                await Conversation.findOneAndUpdate(
                    { userId, sessionId: actualSessionId },
                    {
                        $push: { messages: { $each: [currentMessage, assistantMessage] } },
                        $inc: { 'metadata.totalTokens': tokenUsage.total, 'metadata.messageCount': 2 },
                        $set: { modelId, environment: ENV_TYPE, updatedAt: new Date() }
                    },
                    { upsert: true }
                );
                logActivity('info', 'chat_completion', { sessionId: actualSessionId, tokens: tokenUsage }, userId);
            });

            response.data.on('error', async (err: Error) => {
                console.error('[Orchestrator] Stream error:', err);
                if (!res.headersSent) res.status(500).json({ error: 'Stream error' }); // Probably too late for status
                else res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            });

        } catch (error: any) {
            console.error('[Orchestrator] Process Error:', error.message);
            if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error: ' + error.message });
        }
    };

    if (isMultipart) {
        const bb = busboy({ headers: req.headers });

        bb.on('field', (name: string, val: string) => {
            if (name === 'message') message = val;
            if (name === 'sessionId') sessionId = val;
            if (name === 'modelId') modelId = val;
            if (name === 'collectionId') collectionId = val;
            if (name === 'context') context = val;
            if (name === 'scenarioId') scenarioId = val;
            if (name === 'images') { try { images = JSON.parse(val); } catch (e) { } } // If images passed as JSON field?
            // Usually images/files not passed as field in multipart if strictly binary, but frontend might send JSON for images?
            // Let's assume frontend sends binary for new files, and JSON for existing images?
        });

        const filePromises: Promise<void>[] = [];

        // @ts-ignore
        bb.on('file', (name: string, file: any, info: any) => {
            const promise = new Promise<void>(async (resolve) => {
                const chunks: any[] = [];
                file.on('data', (d: any) => chunks.push(d));
                file.on('end', async () => {
                    const buf = Buffer.concat(chunks);
                    files.push({
                        name: info.filename,
                        mediaType: info.mimeType,
                        size: buf.length,
                        // Content: Don't store full content in history strictly? Or maybe just summary?
                        // For history replay, we might need text.
                        // Let's rely on IR extraction for content.
                    });

                    // Call Knowledge Service to Parse
                    try {
                        const formData = new FormData();
                        formData.append('file', buf, { filename: info.filename, contentType: info.mimeType });

                        const parseRes = await axios.post(`${KNOWLEDGE_URL}/parse`, formData, {
                            headers: formData.getHeaders(),
                            maxBodyLength: Infinity,
                            maxContentLength: Infinity
                        });

                        if (parseRes.data.success) {
                            fileParses.push(parseRes.data.ir);
                            // Also attach extracted text to the file object for history if we want
                            // files[files.length-1].content = ... join blocks ...
                        }
                    } catch (e) {
                        console.error(`[Orchestrator] Failed to parse file ${info.filename}`, e);
                    }
                    resolve();
                });
            });
            filePromises.push(promise);
        });

        bb.on('close', async () => {
            await Promise.all(filePromises);
            processRequest();
        });

        req.pipe(bb);
    } else {
        // Fallback for JSON body (Old way, or text-only)
        message = req.body.message;
        sessionId = req.body.sessionId;
        modelId = req.body.modelId;
        collectionId = req.body.collectionId;
        context = req.body.context;
        images = req.body.images;
        files = req.body.files;
        scenarioId = req.body.scenarioId;

        // If files are present in JSON (Legacy or Text extraction done in Frontend)
        // We should format them using legacy way OR try to adapt?
        // Let's keep logic compatible:
        // If files have 'content', use it.
        // But for new robust system, we prefer Multipart.
        processRequest();
    }
});

// --- Get Available Models ---
app.get('/api/chat/models', authenticateToken, async (req: any, res: Response) => {
    try {
        const response = await axios.get(`${BEDROCK_TEXT_URL}/models`, {
            headers: { 'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-secret-key' }
        });
        res.json(response.data);
    } catch (error: any) {
        console.error('[Orchestrator] Failed to fetch models:', error.message);
        res.status(500).json({ error: 'Failed to fetch available models' });
    }
});

// --- Get Chat History ---
app.get('/api/chat/:sessionId', authenticateToken, async (req: any, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    try {
        const historyKey = `chat:${userId}:${sessionId}`;
        const rawHistory = await redis.lrange(historyKey, 0, -1);

        if (rawHistory.length > 0) {
            const messages = rawHistory.map(item => JSON.parse(item));
            return res.json({ sessionId, messages, source: 'cache' });
        }

        const conversation = await Conversation.findOne({ userId, sessionId });
        if (conversation) {
            for (const msg of conversation.messages) {
                await redis.rpush(historyKey, JSON.stringify(msg));
            }
            await redis.expire(historyKey, 86400);

            return res.json({
                sessionId,
                messages: conversation.messages,
                metadata: conversation.metadata,
                source: 'database'
            });
        }

        res.json({ sessionId, messages: [], source: 'none' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to retrieve history' });
    }
});

// --- List User Sessions ---
app.get('/api/chat', authenticateToken, async (req: any, res: Response) => {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
        const conversations = await Conversation.find({ userId })
            .select('sessionId metadata createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .limit(limit);

        res.json({ conversations });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
});

// --- Clear Session ---
app.delete('/api/chat/:sessionId', authenticateToken, async (req: any, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    try {
        const historyKey = `chat:${userId}:${sessionId}`;

        // 1. Clear from Redis
        await redis.del(historyKey);

        // 2. Clear from MongoDB
        await Conversation.findOneAndDelete({ userId, sessionId });

        logActivity('info', 'session_cleared', { sessionId }, userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to clear session' });
    }
});

// --- Health Check ---
app.get('/health', (req, res) => res.json({
    status: 'ok',
    service: 'orchestrator',
    environment: ENV_TYPE,
    rateLimit: RATE_LIMIT
}));


// --- Prompt Management API ---

// 1. List Prompts (searchable/filterable)
app.get('/api/prompts', authenticateToken, async (req: any, res: Response) => {
    const { type, isPublic, ownerId } = req.query;
    const userId = req.user.userId;

    try {
        const query: any = {};

        // Filter by type if provided
        if (type) query.type = type;

        // Visibility Logic:
        // Superadmin: Can see all (if no filters)
        // User: Can see (isPublic=true) OR (ownerId=userId)

        if (req.user.role === 'superadmin') {
            if (isPublic) query.isPublic = isPublic === 'true';
            if (ownerId) query.ownerId = ownerId;
            // If user specifically asked for scenarios, show all or filtered. 
            // Admin view of core prompts is default if type=core.
        } else {
            // Regular user constraints
            if (type === 'core') {
                // Users generally don't list core prompts unless for some read-only view?
                // Let's allow read for now? Or restrict? 
                // AdminCorePrompts uses type=core. User doesn't access it.
                // Scenarios uses type=scenario.
            }

            // For scenarios:
            query.$or = [
                { isPublic: true },
                { ownerId: userId }
            ];

            // If they specifically asked for their own:
            if (ownerId === userId) {
                delete query.$or;
                query.ownerId = userId;
            }
        }

        const prompts = await Prompt.find(query).sort({ updatedAt: -1 });
        res.json({ prompts });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});

// 2. Get Single Prompt
app.get('/api/prompts/:key', authenticateToken, async (req: any, res: Response) => {
    const { key } = req.params;
    const userId = req.user.userId;

    try {
        const prompt = await Prompt.findOne({ key });
        if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

        // Access Check
        if (req.user.role !== 'superadmin' && !prompt.isPublic && prompt.ownerId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ prompt });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch prompt' });
    }
});

// 3. Create Prompt
app.post('/api/prompts', authenticateToken, async (req: any, res: Response) => {
    const { type, key, name, description, content, isPublic, tags } = req.body;
    const userId = req.user.userId;

    // RBAC: Only superadmin can create CORE prompts
    if (type === 'core' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmins can create core prompts' });
    }

    try {
        const newPrompt = new Prompt({
            key,
            type: type || 'scenario',
            ownerId: type === 'core' ? null : userId, // Core prompts are system-owned (null)
            name,
            description,
            isPublic: type === 'core' ? false : !!isPublic, // Default scenarios to private
            tags: tags || [],
            activeVersion: 1,
            versions: [{
                version: 1,
                content: content || '',
                changelog: 'Initial creation',
                createdBy: userId,
                createdAt: new Date()
            }]
        });

        await newPrompt.save();
        res.status(201).json({ prompt: newPrompt });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Prompt key already exists' });
        }
        res.status(500).json({ error: 'Failed to create prompt' });
    }
});

// 4. Add Version (Update Content)
app.post('/api/prompts/:key/versions', authenticateToken, async (req: any, res: Response) => {
    const { key } = req.params;
    const { content, changelog } = req.body;
    const userId = req.user.userId;

    try {
        const prompt = await Prompt.findOne({ key });
        if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

        // Access Check
        if (req.user.role !== 'superadmin' && prompt.ownerId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const newVersion = (prompt.activeVersion || 0) + 1;

        prompt.versions.push({
            version: newVersion,
            content,
            changelog: changelog || 'Updated version',
            createdBy: userId,
            createdAt: new Date()
        });

        // Auto-activate new version for now (User UX preference usually)
        prompt.activeVersion = newVersion;
        prompt.updatedAt = new Date();

        await prompt.save();

        // Invalidate Cache
        if (prompt.type === 'core') {
            const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}CORE:${prompt.tags.includes('PROD') ? 'PROD' : 'TEST'}`;
            // Broad invalidation
            await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:PROD`);
            await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:TEST`);
        } else {
            await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}SCENARIO:${prompt._id}`);
        }

        res.json({ success: true, prompt });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to add version' });
    }
});

// 5. Activate Prompt (Toggle isActive) - Mainly for Core Prompts
// 5. Toggle Prompt Activation (Activate/Deactivate)
app.post('/api/prompts/:key/toggle-active', authenticateToken, async (req: any, res: Response) => {
    const { key } = req.params;
    const { isActive } = req.body; // Explicitly set state if provided, otherwise toggle? Let's stick to explicit set.

    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmins can activate/deactivate prompts' });
    }

    try {
        const prompt = await Prompt.findOne({ key });
        if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

        const newState = typeof isActive === 'boolean' ? isActive : !prompt.isActive;

        // If activating a Core prompt, enforce mutual exclusivity per environment
        if (newState === true && prompt.type === 'core') {
            const envTag = prompt.tags.find(t => ['PROD', 'TEST'].includes(t));
            if (envTag) {
                // Deactivate all others with this tag
                await Prompt.updateMany(
                    { type: 'core', tags: envTag, _id: { $ne: prompt._id } },
                    { isActive: false }
                );
            }
        }

        prompt.isActive = newState;
        await prompt.save();

        // Invalidate Cache
        await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:PROD`);
        await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:TEST`);

        res.json({ success: true, prompt });
    } catch (error: any) {
        res.status(500).json({ error: 'Activation toggle failed' });
    }
});


// 6. Test Prompt (Playground Proxy)
app.post('/api/prompts/test', authenticateToken, async (req: any, res: Response) => {
    const { systemContent, userMessage } = req.body;

    // Bedrock Proxy with Stream Parsing
    try {
        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: userMessage }
        ];

        const response = await axios.post(`${BEDROCK_TEXT_URL}/chat`, {
            messages,
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        }, {
            responseType: 'stream'
        });

        let fullText = '';

        response.data.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.text) fullText += data.text;
                    } catch (e) { }
                }
            }
        });

        response.data.on('end', () => {
            res.json({ text: fullText });
        });

        response.data.on('error', (err: any) => {
            console.error('Stream error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Stream processing failed' });
        });

    } catch (error: any) {
        res.status(500).send('Test execution failed: ' + error.message);
    }
});

const PORT = process.env.PORT || 8080;







app.listen(PORT, () => {
    console.log(`[Orchestrator] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
