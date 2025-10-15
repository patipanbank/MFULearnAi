import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  // Server
  NODE_ENV: string;
  APP_ENV: string;
  PORT: number;

  // Redis
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;

  // PostgreSQL
  POSTGRES_URL: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;

  // MongoDB
  MONGODB_URI: string;

  // JWT
  JWT_SECRET: string;
  JWT_ALGORITHM: string;
  JWT_EXPIRE_MINUTES: number;

  // AWS Bedrock
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  BEDROCK_MODEL_ID: string;

  // OpenAI
  OPENAI_API_KEY?: string;

  // External Services
  AUTH_SERVICE_URL: string;
  RAG_SERVICE_URL: string;
  AGENT_SERVICE_URL: string;

  // Frontend
  FRONTEND_URL: string;
  PROD_FRONTEND_URL: string;
  CORS_ORIGIN: string;

  // Chat Configuration
  MAX_CONCURRENT_CHATS: number;
  STREAM_TIMEOUT_MS: number;
  MAX_MESSAGE_LENGTH: number;
  MAX_ITERATIONS: number;
  CHECKPOINT_TTL_SECONDS: number;

  // Logging
  LOG_LEVEL: string;
  LOG_FORMAT: string;

  // Monitoring
  ENABLE_METRICS: boolean;
  METRICS_PORT: number;
}

const APP_ENV = process.env.APP_ENV || process.env.NODE_ENV || 'development';

const config: Config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'production',
  APP_ENV,
  PORT: parseInt(process.env.PORT || '5002', 10),

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // PostgreSQL
  POSTGRES_URL: process.env.POSTGRES_URL || 'postgresql://user:password@localhost:5432/chat_service',
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  POSTGRES_USER: process.env.POSTGRES_USER || 'user',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'password',
  POSTGRES_DB: process.env.POSTGRES_DB || 'chat_service',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu_chatbot',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
  JWT_EXPIRE_MINUTES: parseInt(process.env.JWT_EXPIRE_MINUTES || '43200', 10),

  // AWS Bedrock
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  // External Services
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://localhost:5003',
  AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL || 'http://localhost:5004',

  // Frontend
  FRONTEND_URL: APP_ENV === 'development'
    ? (process.env.DEV_FRONTEND_URL || 'http://localhost:8080')
    : (process.env.PROD_FRONTEND_URL || 'https://mfulearnai.mfu.ac.th'),
  PROD_FRONTEND_URL: process.env.PROD_FRONTEND_URL || 'https://mfulearnai.mfu.ac.th',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://mfulearnai.mfu.ac.th',

  // Chat Configuration
  MAX_CONCURRENT_CHATS: parseInt(process.env.MAX_CONCURRENT_CHATS || '100', 10),
  STREAM_TIMEOUT_MS: parseInt(process.env.STREAM_TIMEOUT_MS || '300000', 10),
  MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH || '10000', 10),
  MAX_ITERATIONS: parseInt(process.env.MAX_ITERATIONS || '5', 10),
  CHECKPOINT_TTL_SECONDS: parseInt(process.env.CHECKPOINT_TTL_SECONDS || '3600', 10),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FORMAT: process.env.LOG_FORMAT || 'json',

  // Monitoring
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  METRICS_PORT: parseInt(process.env.METRICS_PORT || '9090', 10),
};

// Validation
if (!config.JWT_SECRET || config.JWT_SECRET === 'default-secret-change-in-production') {
  console.warn('⚠️ WARNING: Using default JWT_SECRET. Please set JWT_SECRET in environment variables!');
}

if (config.APP_ENV === 'production' && !config.AWS_ACCESS_KEY_ID) {
  console.warn('⚠️ WARNING: AWS credentials not set in production environment!');
}

console.log('✅ Configuration loaded successfully');
console.log(`📍 Environment: ${config.APP_ENV}`);
console.log(`📍 Port: ${config.PORT}`);
console.log(`📍 Frontend URL: ${config.FRONTEND_URL}`);

export default config;
