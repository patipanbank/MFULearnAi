/**
 * API Gateway Configuration
 *
 * This file contains all configuration for the API Gateway including
 * service URLs, CORS settings, and environment-specific configs.
 */

interface Config {
  env: string;
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  services: {
    auth: string;
    department: string;
    chat: string;
    agent: string;
    rag: string;
    training: string;
    storage: string;
  };
  jwt: {
    secret: string;
  };
}

const config: Config = {
  // Environment
  env: process.env.NODE_ENV || 'development',

  // Server Port
  port: parseInt(process.env.PORT || '8080', 10),

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:5173', 'http://localhost:3000', 'https://mfulearnai.mfu.ac.th'],
    credentials: true,
  },

  // Microservices URLs
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth-service.mfulearnai.svc.cluster.local:5001',
    department: process.env.DEPARTMENT_SERVICE_URL || 'http://department-service.mfulearnai.svc.cluster.local:5002',
    chat: process.env.CHAT_SERVICE_URL || 'http://chat-service.mfulearnai.svc.cluster.local:5002',
    agent: process.env.AGENT_SERVICE_URL || 'http://agent-service.mfulearnai.svc.cluster.local:5003',
    rag: process.env.RAG_SERVICE_URL || 'http://rag-service.mfulearnai.svc.cluster.local:5004',
    training: process.env.TRAINING_SERVICE_URL || 'http://training-service.mfulearnai.svc.cluster.local:5005',
    storage: process.env.STORAGE_SERVICE_URL || 'http://storage-service.mfulearnai.svc.cluster.local:5005',
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  },
};

export default config;
