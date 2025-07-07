"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
const appConfig = () => ({
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000'),
    apiPrefix: process.env.API_PREFIX || 'api',
    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
        credentials: process.env.CORS_CREDENTIALS === 'true',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-API-Key'],
        exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
        maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'),
    },
    swagger: {
        enabled: process.env.SWAGGER_ENABLED !== 'false',
        title: process.env.SWAGGER_TITLE || 'MFU Learn AI (Node Backend)',
        description: process.env.SWAGGER_DESCRIPTION || 'Advanced AI Learning Platform API',
        version: process.env.SWAGGER_VERSION || '0.1.0',
        path: process.env.SWAGGER_PATH || 'docs',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'simple',
        filename: process.env.LOG_FILENAME,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'),
        datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
    },
    health: {
        enabled: process.env.HEALTH_ENABLED !== 'false',
        path: process.env.HEALTH_PATH || 'health',
        timeout: parseInt(process.env.HEALTH_TIMEOUT || '10000'),
    },
    monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        metricsPath: process.env.METRICS_PATH || 'metrics',
        interval: parseInt(process.env.MONITORING_INTERVAL || '60000'),
    },
    gracefulShutdown: {
        timeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'),
        signals: (process.env.GRACEFUL_SHUTDOWN_SIGNALS || 'SIGTERM,SIGINT').split(','),
    },
});
exports.appConfig = appConfig;
//# sourceMappingURL=app.config.js.map