import dotenv from 'dotenv';

dotenv.config();

interface Config {
  env: string;
  port: number;
  apiVersion: string;
  mongodb: {
    uri: string;
  };
  redis: {
    url: string;
    password?: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  session: {
    secret: string;
  };
  anthropic: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  upload: {
    maxFileSize: number;
    uploadDir: string;
    allowedTypes: string[];
  };
  cors: {
    origins: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  saml?: {
    entryPoint: string;
    issuer: string;
    callbackUrl: string;
    cert: string;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu_chatbot',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  session: {
    secret: process.env.SESSION_SECRET || 'your-session-secret',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10),
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || '.pdf,.doc,.docx,.txt,.md').split(','),
  },

  cors: {
    origins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

// Add SAML configuration if enabled
if (process.env.SAML_ENTRY_POINT) {
  config.saml = {
    entryPoint: process.env.SAML_ENTRY_POINT,
    issuer: process.env.SAML_ISSUER || 'mfulearnai',
    callbackUrl: process.env.SAML_CALLBACK_URL || '',
    cert: process.env.SAML_CERT || '',
  };
}

export default config;
