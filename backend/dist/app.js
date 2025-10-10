"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = __importDefault(require("./config/config"));
const mongodb_1 = require("./lib/mongodb");
const redis_1 = require("./lib/redis");
const auth_1 = __importDefault(require("./routes/auth"));
const chat_1 = __importDefault(require("./routes/chat"));
const admin_1 = __importDefault(require("./routes/admin"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
const corsOrigins = config_1.default.ALLOWED_ORIGINS ? config_1.default.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
app.use((0, cors_1.default)({
    origin: corsOrigins,
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
if (config_1.default.APP_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
app.get('/health', async (req, res) => {
    try {
        const redisHealthy = await redis_1.redis.ping() === 'PONG';
        res.status(200).json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: config_1.default.APP_ENV,
            services: {
                database: 'connected',
                redis: redisHealthy ? 'connected' : 'disconnected',
            },
        });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'MFU Learn AI API - Production Ready',
        version: '2.0.0',
        environment: config_1.default.APP_ENV,
    });
});
const apiRouter = express_1.default.Router();
apiRouter.use('/auth', auth_1.default);
apiRouter.use('/chat', chat_1.default);
apiRouter.use('/admin', admin_1.default);
app.use('/api', apiRouter);
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Internal server error',
    });
});
const startServer = async () => {
    try {
        await (0, mongodb_1.connectDB)();
        try {
            const redisHealthy = await redis_1.redis.ping();
            if (redisHealthy !== 'PONG') {
                console.warn('⚠️  Redis connection test failed, but continuing...');
            }
        }
        catch (error) {
            console.warn('⚠️  Redis connection test failed, but continuing...');
        }
        const PORT = config_1.default.PORT;
        app.listen(PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 MFU Learn AI Backend Server - Production Ready');
            console.log('='.repeat(60));
            console.log(`📍 Environment: ${config_1.default.APP_ENV}`);
            console.log(`🌐 Port: ${PORT}`);
            console.log(`🔗 URL: http://localhost:${PORT}`);
            console.log(`🏥 Health: http://localhost:${PORT}/health`);
            console.log('='.repeat(60) + '\n');
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await redis_1.redis.quit();
        console.log('✅ Redis disconnected');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
startServer();
exports.default = app;
//# sourceMappingURL=app.js.map