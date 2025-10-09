import dotenv from 'dotenv';

dotenv.config();

interface Config {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  RAG_SERVICE_URL: string;
  STORAGE_SERVICE_URL: string;
  JWT_SECRET: string;
}

const config: Config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3005', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearning',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://localhost:3004',
  STORAGE_SERVICE_URL: process.env.STORAGE_SERVICE_URL || 'http://localhost:3006',
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-key-change-in-production',
};

export default config;
