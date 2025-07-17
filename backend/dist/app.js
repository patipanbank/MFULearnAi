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
const websocketService_1 = require("./services/websocketService");
const mongodb_1 = require("./lib/mongodb");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
apiRouter.use('/agent', agent_1.default);
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
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    wsService.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    wsService.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=app.js.map