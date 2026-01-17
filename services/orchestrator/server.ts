import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import { ChatMessage, ServiceResponse } from '../../shared/types';
import { getSystemPrompt, CONTEXT_PROMPTS } from './systemPrompts';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Environment Configuration
const BEDROCK_URL = process.env.BEDROCK_URL || 'http://localhost:5000/api/bedrock';
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

// --- Middleware ---
const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

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
        const headers = {
            'x-user-id': userContext.userId,
            'x-role': userContext.role,
            'x-department': userContext.department || 'General'
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

// --- Chat Endpoint ---
app.post('/api/chat', authenticateToken, rateLimiter, async (req: any, res: Response) => {
    const { message, sessionId, modelId, context, collectionId } = req.body;
    const userId = req.user.userId;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const actualSessionId = sessionId || `session-${Date.now()}`;

    try {
        logActivity('info', 'chat_request_received', {
            sessionId: actualSessionId,
            messageLength: message.length,
            modelId,
            collectionId
        }, userId);

        // 1. Get conversation history from Redis
        const historyKey = `chat:${userId}:${actualSessionId}`;
        const rawHistory = await redis.lrange(historyKey, 0, -1);
        const history: ChatMessage[] = rawHistory
            .map(item => JSON.parse(item))
            .filter(msg => (msg.content && msg.content.trim().length > 0) || (msg.images && msg.images.length > 0));

        // 2. RAG: Retrieve Context from Knowledge Base
        // Need to pass user info for permission checks
        const userContext = {
            userId: req.user.userId,
            role: req.user.role,
            department: req.user.department
        };
        const ragContext = await searchKnowledgeBase(message, userContext, collectionId);

        let ragSystemPrompt = '';
        if (ragContext) {
            ragSystemPrompt = `\n\nHere is some relevant context from the Knowledge Base:\n<context>\n${ragContext}\n</context>\nUse this context to answer the user's question if relevant.`;
            logActivity('debug', 'rag_context_retrieved', { length: ragContext.length }, userId);
        }

        // 3. Prepare messages
        const baseSystemPrompt = getSystemPrompt(ENV_TYPE);
        const additionalContext = context && CONTEXT_PROMPTS[context as keyof typeof CONTEXT_PROMPTS]
            ? `\n\n${CONTEXT_PROMPTS[context as keyof typeof CONTEXT_PROMPTS]}`
            : '';

        const systemMessage: ChatMessage = {
            role: 'system',
            content: baseSystemPrompt + additionalContext + ragSystemPrompt,
            timestamp: new Date()
        };

        const currentMessage: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: new Date()
        };

        // Inject system message (new syntax always puts it first)
        const messagesToSend = history.length === 0
            ? [systemMessage, currentMessage]
            : [systemMessage, ...history, currentMessage];

        // 4. Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        try {
            const response = await axios({
                method: 'post',
                url: `${BEDROCK_URL}/chat`,
                data: { messages: messagesToSend, modelId },
                responseType: 'stream',
                timeout: 120000 // 2 minute timeout
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
                            if (data.text) {
                                fullResponseText += data.text;
                            }
                            if (data.type === 'usage' && data.usage) {
                                tokenUsage = data.usage;
                            }
                        } catch (e) { /* ignore parse errors */ }
                    }
                }
                res.write(chunk);
            });

            response.data.on('end', async () => {
                res.end();

                // 5. Save to Redis
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: fullResponseText,
                    timestamp: new Date()
                };

                await redis.rpush(historyKey,
                    JSON.stringify(currentMessage),
                    JSON.stringify(assistantMessage)
                );

                await redis.ltrim(historyKey, -50, -1);
                await redis.expire(historyKey, 86400);

                // 6. Persist to MongoDB
                await Conversation.findOneAndUpdate(
                    { userId, sessionId: actualSessionId },
                    {
                        $push: {
                            messages: {
                                $each: [currentMessage, assistantMessage]
                            }
                        },
                        $inc: {
                            'metadata.totalTokens': tokenUsage.total,
                            'metadata.messageCount': 2
                        },
                        $set: {
                            modelId,
                            environment: ENV_TYPE,
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true }
                );

                logActivity('info', 'chat_request_completed', {
                    sessionId: actualSessionId,
                    responseLength: fullResponseText.length,
                    tokens: tokenUsage
                }, userId);
            });

            response.data.on('error', async (err: Error) => {
                console.error('[Orchestrator] Stream error:', err);
                res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
                res.end();
                logActivity('error', 'chat_stream_error', { error: err.message }, userId);
            });

        } catch (bedrockError: any) {
            console.error('[Orchestrator] Bedrock Error:', bedrockError.message);
            if (bedrockError.code === 'ECONNREFUSED' || bedrockError.code === 'ETIMEDOUT') {
                res.write(`event: error\ndata: ${JSON.stringify({
                    error: 'AI service temporarily unavailable. Please try again.',
                    retryable: true
                })}\n\n`);
            } else {
                res.write(`event: error\ndata: ${JSON.stringify({
                    error: 'Failed to generate response'
                })}\n\n`);
            }
            res.end();

            logActivity('error', 'bedrock_error', {
                error: bedrockError.message,
                code: bedrockError.code
            }, userId);
        }

    } catch (error: any) {
        console.error('[Orchestrator] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
        logActivity('error', 'orchestrator_error', { error: error.message }, userId);
    }
});

// --- Get Available Models ---
app.get('/api/chat/models', authenticateToken, async (req: any, res: Response) => {
    try {
        const response = await axios.get(`${BEDROCK_URL}/models`);
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`[Orchestrator] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});