"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ioredis_1 = __importDefault(require("ioredis"));
const mongoose_1 = __importDefault(require("mongoose"));
const systemPrompts_1 = require("./systemPrompts");
const Prompt_1 = __importDefault(require("./models/Prompt"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '50mb' }));
app.use((0, cors_1.default)());
// Environment Configuration
const BEDROCK_TEXT_URL = process.env.BEDROCK_TEXT_URL || 'http://localhost:5001/api/bedrock';
const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:6000/api/logs';
const KNOWLEDGE_URL = process.env.KNOWLEDGE_URL || 'http://localhost:7000/api/knowledge';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-chat';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const ENV_TYPE = (process.env.ENV_TYPE || 'TEST');
// Redis Client
const redis = new ioredis_1.default(REDIS_URL);
redis.on('error', (err) => console.error('[Orchestrator] Redis Error', err));
// MongoDB Connection
mongoose_1.default.connect(MONGO_URI)
    .then(() => console.log(`[Orchestrator] Connected to MongoDB (${ENV_TYPE})`))
    .catch(err => console.error('[Orchestrator] MongoDB error:', err));
// Conversation Schema
const ConversationSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true, index: true },
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
const Conversation = mongoose_1.default.model('Conversation', ConversationSchema);
// --- Logger Helper ---
const logActivity = async (level, action, context, userId) => {
    try {
        await axios_1.default.post(LOGGER_URL, {
            level,
            service: 'orchestrator',
            userId,
            action,
            details: context,
            environment: ENV_TYPE,
            timestamp: new Date().toISOString()
        });
    }
    catch (err) {
        console.error('[Orchestrator] Failed to log:', err);
    }
};
// --- Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};
// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT = ENV_TYPE === 'PROD' ? 30 : 100;
const RATE_WINDOW = 60 * 1000;
const rateLimiter = (req, res, next) => {
    var _a;
    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || req.ip;
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
async function searchKnowledgeBase(query, userContext, collectionId) {
    var _a, _b;
    // If collectionId provided, passed it.
    try {
        const payload = { query, limit: 3 };
        if (collectionId)
            payload.collectionId = collectionId;
        // Pass User Context Headers so Knowledge Service can enforce visibility
        const headers = {
            'x-user-id': userContext.userId,
            'x-role': userContext.role,
            'x-department': userContext.department || 'General'
        };
        const response = await axios_1.default.post(`${KNOWLEDGE_URL}/search`, payload, { headers });
        console.log(`[Orchestrator] RAG Search for collection ${collectionId || 'default'}: Found ${((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.results) === null || _b === void 0 ? void 0 : _b.length) || 0} hits`);
        if (response.data && response.data.results) {
            const context = response.data.results
                .map((hit) => `[Source: ${hit.metadata.source}]\n${hit.content}`)
                .join('\n\n');
            console.log('[Orchestrator] RAG Context Length:', context.length);
            return context;
        }
    }
    catch (error) {
        console.warn('[Orchestrator] Knowledge search failed:', error.message);
        console.warn('[Orchestrator] Payload was:', { query, collectionId });
    }
    return '';
}
// --- Prompt Logic ---
const SYSTEM_PROMPT_KEY_PREFIX = 'system_prompt:';
const getCoreSystemPrompt = async (envType) => {
    var _a, _b;
    // 1. Try Cache
    const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}CORE:${envType}`;
    const cached = await redis.get(cacheKey);
    if (cached)
        return cached;
    // 2. Try DB (Find active core prompt for this env)
    // We assume tags contain 'PROD' or 'TEST' or key contains it
    // For simplicity, let's stick to the convention: key must be DINDINAI_PROD or MFULEARNAI_TEST to be auto-picked
    // OR we allow setting one active core prompt globally per type.
    // Better strategy: Find active prompt with type='core' and tag=envType
    // But currently data migration might be empty.
    // Fallback Keys
    const fallbackKey = envType === 'PROD' ? 'DINDINAI_SYSTEM_PROMPT' : 'MFULEARNAI_SYSTEM_PROMPT';
    const promptDoc = await Prompt_1.default.findOne({
        type: 'core',
        isActive: true,
        $or: [{ key: fallbackKey }, { tags: envType }]
    });
    if (promptDoc) {
        const content = ((_a = promptDoc.versions.find(v => v.version === promptDoc.activeVersion)) === null || _a === void 0 ? void 0 : _a.content) || ((_b = promptDoc.versions[0]) === null || _b === void 0 ? void 0 : _b.content) || '';
        await redis.set(cacheKey, content, 'EX', 300); // 5 min cache
        return content;
    }
    // 3. Fallback to File
    return (0, systemPrompts_1.getSystemPrompt)(envType);
};
const getScenarioPrompt = async (scenarioId, userId) => {
    var _a;
    const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}SCENARIO:${scenarioId}`;
    const cached = await redis.get(cacheKey);
    if (cached)
        return cached;
    const prompt = await Prompt_1.default.findOne({ _id: scenarioId }); // Assuming ID is passed, or Key
    if (!prompt)
        return '';
    // Access Check (Public or Owner)
    if (!prompt.isPublic && prompt.ownerId !== userId)
        return '';
    const content = ((_a = prompt.versions.find(v => v.version === prompt.activeVersion)) === null || _a === void 0 ? void 0 : _a.content) || '';
    if (content) {
        await redis.set(cacheKey, content, 'EX', 300);
    }
    return content;
};
// --- Variable Injection Helper ---
const injectVariables = (template, user) => {
    // Logic for Department: if missing (e.g. Google Auth), use 'External' or 'None'
    const department = user.department && user.department.trim().length > 0
        ? user.department
        : 'External (Google Auth/No Department)';
    const variables = {
        '{{UserRole}}': user.role || 'student',
        '{{UserDepartment}}': department,
        '{{FirstName}}': user.firstName || 'User'
    };
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        // Global replace of all instances
        result = result.replace(new RegExp(key, 'g'), value);
    }
    return result;
};
// --- Chat Endpoint ---
app.post('/api/chat', authenticateToken, rateLimiter, async (req, res) => {
    const { message, sessionId, modelId, context, collectionId, images, files } = req.body;
    const userId = req.user.userId;
    if (!message && (!images || images.length === 0) && (!files || files.length === 0)) {
        return res.status(400).json({ error: 'Message or attachment is required' });
    }
    const actualSessionId = sessionId || `session-${Date.now()}`;
    try {
        logActivity('info', 'chat_request_received', {
            sessionId: actualSessionId,
            messageLength: (message === null || message === void 0 ? void 0 : message.length) || 0,
            modelId,
            collectionId,
            fileCount: (files === null || files === void 0 ? void 0 : files.length) || 0
        }, userId);
        // 1. Get conversation history from Redis
        const historyKey = `chat:${userId}:${actualSessionId}`;
        const rawHistory = await redis.lrange(historyKey, 0, -1);
        const history = rawHistory
            .map(item => JSON.parse(item))
            .filter(msg => (msg.content && msg.content.trim().length > 0) ||
            (msg.images && msg.images.length > 0) ||
            (msg.files && msg.files.length > 0));
        // 2. RAG: Retrieve Context (kept same)
        const userContext = {
            userId: req.user.userId,
            role: req.user.role,
            department: req.user.department
        };
        const ragContext = await searchKnowledgeBase(message || '', userContext, collectionId);
        let ragSystemPrompt = '';
        if (ragContext) {
            ragSystemPrompt = `\n\nHere is some relevant context from the Knowledge Base:\n<context>\n${ragContext}\n</context>\nUse this context to answer the user's question if relevant.`;
            logActivity('debug', 'rag_context_retrieved', { length: ragContext.length }, userId);
        }
        // 3. Prepare messages
        const corePrompt = await getCoreSystemPrompt(ENV_TYPE);
        let scenarioPrompt = '';
        if (req.body.scenarioId) {
            scenarioPrompt = await getScenarioPrompt(req.body.scenarioId, req.user.userId);
            if (scenarioPrompt) {
                scenarioPrompt = `\n\n=== ACT AS FOLLOWS ===\n${scenarioPrompt}`;
            }
        }
        const additionalContext = context && systemPrompts_1.CONTEXT_PROMPTS[context]
            ? `\n\n${systemPrompts_1.CONTEXT_PROMPTS[context]}`
            : '';
        let finalSystemContent = corePrompt + additionalContext + ragSystemPrompt + scenarioPrompt;
        // Inject Dynamic Variables (e.g. {{CurrentTime}})
        finalSystemContent = injectVariables(finalSystemContent, req.user);
        const systemMessage = {
            role: 'system',
            content: finalSystemContent,
            timestamp: new Date()
        };
        const currentMessage = {
            role: 'user',
            content: message || '',
            images: images || [],
            files: files || [],
            timestamp: new Date()
        };
        // Construct Bedrock Messages (Inject File Content into Message Text for the model)
        const formatMessageForAI = (msg) => {
            let content = msg.content || '';
            if (msg.files && msg.files.length > 0) {
                msg.files.forEach(f => {
                    content += `\n\n<file_context name="${f.name}">\n${f.content}\n</file_context>`;
                });
            }
            return {
                role: msg.role,
                content: content, // Combined content
                images: msg.images // Keep images separate (multimodal)
            };
        };
        // Inject system message (new syntax always puts it first)
        const messagesToSend = [
            systemMessage,
            ...history.map(formatMessageForAI), // Transform history
            formatMessageForAI(currentMessage) // Transform current
        ];
        // 4. Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        try {
            const response = await (0, axios_1.default)({
                method: 'post',
                url: `${BEDROCK_TEXT_URL}/chat`,
                data: { messages: messagesToSend, modelId },
                responseType: 'stream',
                timeout: 120000 // 2 minute timeout
            });
            let fullResponseText = '';
            let tokenUsage = { input: 0, output: 0, total: 0 };
            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]')
                            continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.text) {
                                fullResponseText += data.text;
                            }
                            if (data.type === 'usage' && data.usage) {
                                tokenUsage = data.usage;
                            }
                        }
                        catch (e) { /* ignore parse errors */ }
                    }
                }
                res.write(chunk);
            });
            response.data.on('end', async () => {
                res.end();
                // 5. Save to Redis
                const assistantMessage = {
                    role: 'assistant',
                    content: fullResponseText,
                    timestamp: new Date()
                };
                await redis.rpush(historyKey, JSON.stringify(currentMessage), JSON.stringify(assistantMessage));
                await redis.ltrim(historyKey, -50, -1);
                await redis.expire(historyKey, 86400);
                // 6. Persist to MongoDB
                await Conversation.findOneAndUpdate({ userId, sessionId: actualSessionId }, {
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
                }, { upsert: true });
                logActivity('info', 'chat_request_completed', {
                    sessionId: actualSessionId,
                    responseLength: fullResponseText.length,
                    tokens: tokenUsage
                }, userId);
            });
            response.data.on('error', async (err) => {
                console.error('[Orchestrator] Stream error:', err);
                res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
                res.end();
                logActivity('error', 'chat_stream_error', { error: err.message }, userId);
            });
        }
        catch (bedrockError) {
            console.error('[Orchestrator] Bedrock Error:', bedrockError.message);
            if (bedrockError.code === 'ECONNREFUSED' || bedrockError.code === 'ETIMEDOUT') {
                res.write(`event: error\ndata: ${JSON.stringify({
                    error: 'AI service temporarily unavailable. Please try again.',
                    retryable: true
                })}\n\n`);
            }
            else {
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
    }
    catch (error) {
        console.error('[Orchestrator] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
        logActivity('error', 'orchestrator_error', { error: error.message }, userId);
    }
});
// --- Get Available Models ---
app.get('/api/chat/models', authenticateToken, async (req, res) => {
    try {
        const response = await axios_1.default.get(`${BEDROCK_TEXT_URL}/models`);
        res.json(response.data);
    }
    catch (error) {
        console.error('[Orchestrator] Failed to fetch models:', error.message);
        res.status(500).json({ error: 'Failed to fetch available models' });
    }
});
// --- Get Chat History ---
app.get('/api/chat/:sessionId', authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve history' });
    }
});
// --- List User Sessions ---
app.get('/api/chat', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 20;
    try {
        const conversations = await Conversation.find({ userId })
            .select('sessionId metadata createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .limit(limit);
        res.json({ conversations });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
});
// --- Clear Session ---
app.delete('/api/chat/:sessionId', authenticateToken, async (req, res) => {
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
    }
    catch (error) {
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
app.get('/api/prompts', authenticateToken, async (req, res) => {
    const { type, isPublic, ownerId } = req.query;
    const userId = req.user.userId;
    try {
        const query = {};
        // Filter by type if provided
        if (type)
            query.type = type;
        // Visibility Logic:
        // Superadmin: Can see all (if no filters)
        // User: Can see (isPublic=true) OR (ownerId=userId)
        if (req.user.role === 'superadmin') {
            if (isPublic)
                query.isPublic = isPublic === 'true';
            if (ownerId)
                query.ownerId = ownerId;
            // If user specifically asked for scenarios, show all or filtered. 
            // Admin view of core prompts is default if type=core.
        }
        else {
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
        const prompts = await Prompt_1.default.find(query).sort({ updatedAt: -1 });
        res.json({ prompts });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});
// 2. Get Single Prompt
app.get('/api/prompts/:key', authenticateToken, async (req, res) => {
    const { key } = req.params;
    const userId = req.user.userId;
    try {
        const prompt = await Prompt_1.default.findOne({ key });
        if (!prompt)
            return res.status(404).json({ error: 'Prompt not found' });
        // Access Check
        if (req.user.role !== 'superadmin' && !prompt.isPublic && prompt.ownerId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({ prompt });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch prompt' });
    }
});
// 3. Create Prompt
app.post('/api/prompts', authenticateToken, async (req, res) => {
    const { type, key, name, description, content, isPublic, tags } = req.body;
    const userId = req.user.userId;
    // RBAC: Only superadmin can create CORE prompts
    if (type === 'core' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmins can create core prompts' });
    }
    try {
        const newPrompt = new Prompt_1.default({
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
    }
    catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Prompt key already exists' });
        }
        res.status(500).json({ error: 'Failed to create prompt' });
    }
});
// 4. Add Version (Update Content)
app.post('/api/prompts/:key/versions', authenticateToken, async (req, res) => {
    const { key } = req.params;
    const { content, changelog } = req.body;
    const userId = req.user.userId;
    try {
        const prompt = await Prompt_1.default.findOne({ key });
        if (!prompt)
            return res.status(404).json({ error: 'Prompt not found' });
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
        }
        else {
            await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}SCENARIO:${prompt._id}`);
        }
        res.json({ success: true, prompt });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add version' });
    }
});
// 5. Activate Prompt (Toggle isActive) - Mainly for Core Prompts
app.post('/api/prompts/:key/activate', authenticateToken, async (req, res) => {
    const { key } = req.params;
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmins can activate prompts' });
    }
    try {
        const prompt = await Prompt_1.default.findOne({ key });
        if (!prompt)
            return res.status(404).json({ error: 'Prompt not found' });
        // If it's a CORE prompt, we must deactivate others in the same environment (Tag based)
        if (prompt.type === 'core') {
            const envTag = prompt.tags.find(t => t === 'PROD' || t === 'TEST');
            if (envTag) {
                // Deactivate all others with this tag
                await Prompt_1.default.updateMany({
                    type: 'core',
                    tags: envTag,
                    _id: { $ne: prompt._id }
                }, { $set: { isActive: false } });
            }
        }
        prompt.isActive = true;
        await prompt.save();
        // Invalidate Cache for instant update
        await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:PROD`);
        await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:TEST`);
        res.json({ success: true, prompt });
    }
    catch (error) {
        console.error('Activation Error:', error);
        res.status(500).json({ error: 'Activation failed' });
    }
});
// 6. Test Prompt (Playground Proxy)
app.post('/api/prompts/test', authenticateToken, async (req, res) => {
    const { systemContent, userMessage } = req.body;
    // Bedrock Proxy with Stream Parsing
    try {
        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: userMessage }
        ];
        const response = await axios_1.default.post(`${BEDROCK_TEXT_URL}/chat`, {
            messages,
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        }, {
            responseType: 'stream'
        });
        let fullText = '';
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (dataStr === '[DONE]')
                        continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.text)
                            fullText += data.text;
                    }
                    catch (e) { }
                }
            }
        });
        response.data.on('end', () => {
            res.json({ text: fullText });
        });
        response.data.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent)
                res.status(500).json({ error: 'Stream processing failed' });
        });
    }
    catch (error) {
        res.status(500).send('Test execution failed: ' + error.message);
    }
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`[Orchestrator] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
