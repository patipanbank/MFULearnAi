"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const errorHandler_1 = require("./middleware/errorHandler");
const mongodb_1 = require("./lib/mongodb");
const redis_1 = require("./lib/redis");
const auth_1 = __importDefault(require("./routes/auth"));
const agent_1 = __importDefault(require("./routes/agent"));
const chat_1 = __importDefault(require("./routes/chat"));
const collection_1 = __importDefault(require("./routes/collection"));
const chroma_1 = __importDefault(require("./routes/chroma"));
const bedrock_1 = __importDefault(require("./routes/bedrock"));
const embedding_1 = __importDefault(require("./routes/embedding"));
const upload_1 = __importDefault(require("./routes/upload"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/agents', agent_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/collections', collection_1.default);
app.use('/api/chroma', chroma_1.default);
app.use('/api/bedrock', bedrock_1.default);
app.use('/api/embedding', embedding_1.default);
app.use('/api/upload', upload_1.default);
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
const startServer = async () => {
    try {
        await (0, mongodb_1.connectDB)();
        await (0, redis_1.connectRedis)();
        const port = process.env.PORT || 3001;
        app.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`);
            console.log(`📊 Health check: http://localhost:${port}/health`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});
startServer();
exports.default = app;
//# sourceMappingURL=app.js.map