"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const databaseConfig = () => ({
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu_chatbot',
        options: {
            retryWrites: true,
            w: 'majority',
            maxPoolSize: 10,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,
            bufferCommands: false,
        },
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        keyPrefix: 'mfu_chatbot:',
        lazyConnect: true,
    },
    chroma: {
        url: process.env.CHROMA_URL || 'http://localhost:8000',
        timeout: 30000,
        retries: 3,
    },
});
exports.databaseConfig = databaseConfig;
//# sourceMappingURL=database.config.js.map