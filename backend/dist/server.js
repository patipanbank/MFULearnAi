"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
const express_session_1 = __importDefault(require("express-session"));
const body_parser_1 = __importDefault(require("body-parser"));
const compression_1 = __importDefault(require("compression"));
// Database connection
const mongodb_1 = require("./lib/mongodb");
// Middleware
const errorHandler_1 = require("./middleware/errorHandler");
// Routes - Refactored
const auth_1 = __importDefault(require("./routes/auth"));
const chat_1 = __importDefault(require("./routes/chat"));
const admin_1 = __importDefault(require("./routes/admin"));
// Routes - All refactored
const stats_1 = __importDefault(require("./routes/stats"));
const department_1 = __importDefault(require("./routes/department"));
const usage_1 = __importDefault(require("./routes/usage"));
const models_1 = __importDefault(require("./routes/models"));
const embedding_1 = __importDefault(require("./routes/embedding"));
const training_1 = __importDefault(require("./routes/training"));
// WebSocket server
require("./websocket/ChatWebSocket");
/**
 * Create and configure Express application
 */
function createApp() {
    const app = (0, express_1.default)();
    // Connect to MongoDB
    (0, mongodb_1.connectDB)();
    // CORS configuration
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://mfulearnai.mfu.ac.th'];
    console.log('Allowed origins:', allowedOrigins);
    app.use((0, cors_1.default)({
        origin: function (origin, callback) {
            // Allow requests with no origin (mobile apps, curl)
            if (!origin) {
                return callback(null, true);
            }
            if (allowedOrigins.indexOf(origin) === -1) {
                return callback(new Error('Not allowed by CORS'), false);
            }
            return callback(null, true);
        },
        credentials: true,
    }));
    // Body parser configuration
    const bodyLimit = '1000mb';
    app.use(body_parser_1.default.json({ limit: bodyLimit }));
    app.use(body_parser_1.default.urlencoded({ limit: bodyLimit, extended: true }));
    // Session configuration
    app.use((0, express_session_1.default)({
        secret: process.env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    }));
    // Passport initialization
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    // Request timeout (24 hours for long operations)
    app.use((req, res, next) => {
        res.setTimeout(24 * 60 * 60 * 1000);
        next();
    });
    // Compression (skip for SSE endpoints)
    app.use((req, res, next) => {
        if (req.url.includes('/api/chat') && req.method === 'POST') {
            // Skip compression for chat endpoint (SSE)
            next();
        }
        else {
            (0, compression_1.default)()(req, res, next);
        }
    });
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // API Routes - Refactored
    app.use('/api/auth', auth_1.default);
    app.use('/api/chat', chat_1.default);
    app.use('/api/admin', admin_1.default);
    // API Routes - Original (to be refactored)
    app.use('/api/training', training_1.default);
    app.use('/api/embed', embedding_1.default);
    app.use('/api/models', models_1.default);
    app.use('/api/stats', stats_1.default);
    app.use('/api/departments', department_1.default);
    app.use('/api/usage', usage_1.default);
    // 404 handler (must be after all routes)
    app.use(errorHandler_1.notFoundHandler);
    // Global error handler (must be last)
    app.use(errorHandler_1.errorHandler);
    return app;
}
/**
 * Start the server
 */
function startServer() {
    const app = createApp();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 WebSocket server running on port 5001`);
    });
}
// Start the server
startServer();
