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
const mongodb_1 = require("./lib/mongodb");
const auth_1 = __importDefault(require("./routes/auth"));
const usage_1 = __importDefault(require("./routes/usage"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
// Session middleware for SAML
app.use((0, express_session_1.default)({
    secret: process.env.JWT_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
// Initialize passport
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'auth-service',
        timestamp: new Date().toISOString()
    });
});
// Routes
// Mount at root because ingress will rewrite /api/auth/* to /*
app.use('/', auth_1.default);
app.use('/usage', usage_1.default);
// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        service: 'auth-service'
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
        service: 'auth-service'
    });
});
const startServer = async () => {
    try {
        // Connect to MongoDB
        await (0, mongodb_1.connectDB)();
        console.log('✅ MongoDB connected successfully');
        // Start server
        app.listen(PORT, () => {
            console.log(`🔐 Auth Service running on port ${PORT}`);
            console.log(`📍 Health check: http://localhost:${PORT}/health`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start auth-service:', error);
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
});
startServer();
//# sourceMappingURL=app.js.map