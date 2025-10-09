import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  PORT: number;
  LOG_LEVEL: string;
  NODE_ENV: string;
  MONGODB_URI: string;
  CHROMA_URL: string;
  BEDROCK_SERVICE_URL: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || '3004'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearnai',
  CHROMA_URL: process.env.CHROMA_URL || 'http://localhost:8000',
  BEDROCK_SERVICE_URL: process.env.BEDROCK_SERVICE_URL || 'http://localhost:8000',
};

export default config;
