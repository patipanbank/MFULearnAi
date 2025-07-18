import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mfu_learn_ai',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
  SAML_CERTIFICATE: process.env.SAML_CERTIFICATE,
  SAML_IDP_SSO_URL: process.env.SAML_IDP_SSO_URL,
  SAML_IDP_SLO_URL: process.env.SAML_IDP_SLO_URL,
  SAML_SP_ENTITY_ID: process.env.SAML_SP_ENTITY_ID,
  SAML_IDENTIFIER_FORMAT: process.env.SAML_IDENTIFIER_FORMAT,
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