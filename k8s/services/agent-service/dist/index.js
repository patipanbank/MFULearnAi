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
const agent_1 = __importDefault(require("./routes/agent"));
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'agent-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Readiness check endpoint
app.get('/ready', async (req, res) => {
    try {
        // Check MongoDB connection
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                status: 'not ready',
                reason: 'MongoDB not connected'
            });
        }
        res.status(200).json({
            status: 'ready',
            service: 'agent-service',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'not ready',
            error: error?.message || 'Unknown error'
        });
    }
});
// API Routes
app.use('/api/agents', agent_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});
// Error handler
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: config_1.default.nodeEnv === 'development' ? error.message : 'An error occurred'
    });
});
// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await (0, mongodb_1.connectMongoDB)();
        console.log('MongoDB connected successfully');
        // Start listening
        app.listen(config_1.default.port, () => {
            console.log(`Agent Service running on port ${config_1.default.port}`);
            console.log(`Environment: ${config_1.default.nodeEnv}`);
            console.log(`Health check: http://localhost:${config_1.default.port}/health`);
            console.log(`API endpoint: http://localhost:${config_1.default.port}/api/agents`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
// Start the server
startServer();
//# sourceMappingURL=index.js.map