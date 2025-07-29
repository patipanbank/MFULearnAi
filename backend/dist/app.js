"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("./lib/mongodb");
const redis_1 = require("./lib/redis");
const websocketService_1 = require("./services/websocketService");
const rateLimit_1 = require("./middleware/rateLimit");
const logger_1 = __importDefault(require("./utils/logger"));
const auth_1 = __importDefault(require("./routes/auth"));
const agent_1 = __importDefault(require("./routes/agent"));
const chat_1 = __importDefault(require("./routes/chat"));
const collection_1 = __importDefault(require("./routes/collection"));
const embedding_1 = __importDefault(require("./routes/embedding"));
const upload_1 = __importDefault(require("./routes/upload"));
const bedrock_1 = __importDefault(require("./routes/bedrock"));
const chroma_1 = __importDefault(require("./routes/chroma"));
const analytics_1 = __importDefault(require("./routes/analytics"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const rateLimiters = (0, rateLimit_1.createRateLimiters)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimiters.general);
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
app.use('/api/auth', rateLimiters.auth, auth_1.default);
app.use('/api/agents', rateLimiters.agent, agent_1.default);
app.use('/api/chat', rateLimiters.chat, chat_1.default);
app.use('/api/collections', collection_1.default);
app.use('/api/embeddings', embedding_1.default);
app.use('/api/upload', rateLimiters.upload, upload_1.default);
app.use('/api/bedrock', bedrock_1.default);
app.use('/api/chroma', chroma_1.default);
app.use('/api/analytics', analytics_1.default);
app.use((err, req, res, next) => {
    logger_1.default.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});
const server = app.listen(PORT, async () => {
    try {
        await (0, mongodb_1.connectDB)();
        logger_1.default.info('Connected to MongoDB');
        await (0, redis_1.connectRedis)();
        logger_1.default.info('Connected to Redis');
        const wsService = new websocketService_1.WebSocketService(server);
        logger_1.default.info('WebSocket service initialized');
        logger_1.default.info(`Server running on port ${PORT}`);
        logger_1.default.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger_1.default.info(`Health check: http://localhost:${PORT}/health`);
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', error);
        process.exit(1);
    }
});
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger_1.default.info('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger_1.default.info('Server closed');
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map