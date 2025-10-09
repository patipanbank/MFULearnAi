import dotenv from 'dotenv';

dotenv.config();

export default {
  // Server
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearnai',

  // Service URLs
  ragServiceUrl: process.env.RAG_SERVICE_URL || 'http://rag-service:3004',
  storageServiceUrl: process.env.STORAGE_SERVICE_URL || 'http://storage-service:3006',
  bedrockServiceUrl: process.env.BEDROCK_SERVICE_URL || 'http://bedrock-gateway:8000',

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // API Keys
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  googleCseId: process.env.GOOGLE_CSE_ID,
};
