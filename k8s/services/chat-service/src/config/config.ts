import dotenv from 'dotenv';

dotenv.config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3002', 10),

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearnai',

  // Service URLs
  AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL || 'http://localhost:3003',
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://localhost:3004',
  STORAGE_SERVICE_URL: process.env.STORAGE_SERVICE_URL || 'http://localhost:3006',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

export default config;
