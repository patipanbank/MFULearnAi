import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mfu_learn_ai',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
  bedrock: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  saml: {
    entryPoint: process.env.SAML_ENTRY_POINT,
    issuer: process.env.SAML_ISSUER,
    cert: process.env.SAML_CERT,
  },
}; 