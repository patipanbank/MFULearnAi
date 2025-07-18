"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = require("./config/config");
const mongodb_1 = require("./lib/mongodb");
const http_1 = __importDefault(require("http"));
const websocketService_1 = require("./services/websocketService");
const auth_1 = __importDefault(require("./routes/auth"));
const chat_1 = __importDefault(require("./routes/chat"));
const agent_1 = __importDefault(require("./routes/agent"));
const bedrock_1 = __importDefault(require("./routes/bedrock"));
const queue_1 = __importDefault(require("./routes/queue"));
require("./workers/chatWorker");
require("./workers/agentWorker");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/auth', auth_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/agents', agent_1.default);
app.use('/api/bedrock', bedrock_1.default);
app.use('/api/queue', queue_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
const startServer = async () => {
    try {
        await (0, mongodb_1.connectDB)();
        console.log('✅ Connected to MongoDB');
        const server = http_1.default.createServer(app);
        new websocketService_1.WebSocketService(server);
        server.listen(config_1.config.port, () => {
            console.log(`🚀 Server running on port ${config_1.config.port}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=app.js.map