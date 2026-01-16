import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { ChatMessage, ServiceResponse } from '../../shared/types';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Services URLs
const BEDROCK_URL = process.env.BEDROCK_URL || 'http://localhost:5000/api/bedrock';
const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:6000/api/logs';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis Client
const redis = new Redis(REDIS_URL);
redis.on('error', (err) => console.error('Redis Client Error', err));

// Middleware
const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const logActivity = async (level: string, action: string, context: any, userId?: string) => {
    try {
        await axios.post(LOGGER_URL, {
            level,
            service: 'orchestrator',
            userId,
            action,
            details: context,
            environment: process.env.ENV_TYPE || 'TEST'
        });
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
};

// Chat Endpoint
app.post('/api/chat', authenticateToken, async (req: any, res: any) => {
    const { message, sessionId, modelId } = req.body;
    const userId = req.user.userId;

    if (!message) return res.status(400).json({ error: 'Message is required' });

    try {
        // 1. Log User Request
        logActivity('info', 'chat_request_received', { sessionId, length: message.length }, userId);

        // 2. Retrieve History from Redis
        const historyKey = `chat:${userId}:${sessionId}`;
        const rawHistory = await redis.lrange(historyKey, 0, -1);
        const history: ChatMessage[] = rawHistory.map(item => JSON.parse(item));

        // 3. Construct current context
        const currentMessage: ChatMessage = { role: 'user', content: message, timestamp: new Date() };
        const messagesToSend = [...history, currentMessage];

        // 4. Call Bedrock (Streaming)
        // We need to pipe the response from Bedrock to the client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            const response = await axios({
                method: 'post',
                url: `${BEDROCK_URL}/chat`,
                data: { messages: messagesToSend, modelId },
                responseType: 'stream'
            });

            let fullResponseText = '';

            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.text) fullResponseText += data.text;
                        } catch (e) { }
                    }
                }
                res.write(chunk); // Forward chunk to client
            });

            response.data.on('end', async () => {
                res.end();

                // 5. Save Context to Redis
                const assistantMessage: ChatMessage = { role: 'assistant', content: fullResponseText, timestamp: new Date() };
                await redis.rpush(historyKey, JSON.stringify(currentMessage), JSON.stringify(assistantMessage));
                // Expire chat history after 1 day
                await redis.expire(historyKey, 86400);

                // 6. Log Completion
                logActivity('info', 'chat_request_completed', { sessionId }, userId);
            });

        } catch (bedrockError: any) {
            console.error('Bedrock Error:', bedrockError.message);
            res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
            res.end();
            logActivity('error', 'bedrock_error', { error: bedrockError.message }, userId);
        }

    } catch (error: any) {
        console.error('Orchestrator Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Clear History
app.delete('/api/chat/:sessionId', authenticateToken, async (req: any, res: any) => {
    const { sessionId } = req.params;
    const userId = req.user.userId;
    const historyKey = `chat:${userId}:${sessionId}`;
    await redis.del(historyKey);
    res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'orchestrator' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Orchestrator running on port ${PORT}`);
});
