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
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const http_1 = require("http");
const auth_1 = __importDefault(require("./routes/auth"));
const chat_1 = __importDefault(require("./routes/chat"));
const agent_1 = __importDefault(require("./routes/agent"));
const bedrock_1 = __importDefault(require("./routes/bedrock"));
const chroma_1 = __importDefault(require("./routes/chroma"));
const embedding_1 = __importDefault(require("./routes/embedding"));
const upload_1 = __importDefault(require("./routes/upload"));
const collection_1 = __importDefault(require("./routes/collection"));
const training_1 = __importDefault(require("./routes/training"));
const queue_1 = __importDefault(require("./routes/queue"));
const usage_1 = __importDefault(require("./routes/usage"));
const admin_1 = __importDefault(require("./routes/admin"));
const tools_1 = __importDefault(require("./routes/tools"));
const monitoring_1 = __importDefault(require("./routes/monitoring"));
const websocketService_1 = require("./services/websocketService");
const queueService_1 = require("./services/queueService");
const mongodb_1 = require("./lib/mongodb");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json({
    type: ['application/json', 'text/plain']
}));
app.use(express_1.default.urlencoded({
    extended: true,
    type: 'application/x-www-form-urlencoded'
}));
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
const apiRouter = express_1.default.Router();
apiRouter.use('/auth', auth_1.default);
apiRouter.use('/chat', chat_1.default);
apiRouter.use('/agents', agent_1.default);
apiRouter.use('/bedrock', bedrock_1.default);
apiRouter.use('/chroma', chroma_1.default);
apiRouter.use('/embedding', embedding_1.default);
apiRouter.use('/upload', upload_1.default);
apiRouter.use('/collections', collection_1.default);
apiRouter.use('/training', training_1.default);
apiRouter.use('/queue', queue_1.default);
apiRouter.use('/usage', usage_1.default);
apiRouter.use('/admin', admin_1.default);
apiRouter.use('/tools', tools_1.default);
apiRouter.use('/monitoring', monitoring_1.default);
app.use('/api', apiRouter);
app.get('/', (req, res) => {
    res.send('MFULearnAi Node.js Backend');
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});
const PORT = process.env.PORT || 3001;
const server = (0, http_1.createServer)(app);
const wsService = new websocketService_1.WebSocketService(server);
const startServer = async () => {
    try {
        await (0, mongodb_1.connectDB)();
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌐 WebSocket server available at ws://localhost:${PORT}/ws`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    await queueService_1.queueService.shutdown();
    wsService.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    await queueService_1.queueService.shutdown();
    wsService.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=app.js.map