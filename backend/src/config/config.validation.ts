import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Server
  PORT: Joi.number().port().default(5000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Database
  MONGODB_URI: Joi.string().default('mongodb://localhost:27017/mfulearnai-node'),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: Joi.string().default('dev-jwt-secret'),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  // External Services
  CHROMA_URL: Joi.string().uri().default('http://localhost:8000'),
  
  // AWS
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  AWS_SECRET_ACCESS_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  AWS_BEDROCK_MODEL_ID: Joi.string().default('anthropic.claude-3-5-sonnet-20240620-v1:0'),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  GOOGLE_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),

  // Frontend
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
}); 