export interface AppConfig {
  environment: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
  };
  swagger: {
    enabled: boolean;
    title: string;
    description: string;
    version: string;
    path: string;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    format: 'json' | 'simple';
    filename?: string;
    maxSize: string;
    maxFiles: number;
    datePattern: string;
  };
  health: {
    enabled: boolean;
    path: string;
    timeout: number;
  };
  monitoring: {
    enabled: boolean;
    metricsPath: string;
    interval: number;
  };
  gracefulShutdown: {
    timeout: number;
    signals: string[];
  };
}

export const appConfig = (): AppConfig => ({
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  port: parseInt(process.env.PORT || '5000'),
  apiPrefix: process.env.API_PREFIX || 'api',
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-API-Key'],
    exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'), // 24 hours
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    title: process.env.SWAGGER_TITLE || 'MFU Learn AI (Node Backend)',
    description: process.env.SWAGGER_DESCRIPTION || 'Advanced AI Learning Platform API',
    version: process.env.SWAGGER_VERSION || '0.1.0',
    path: process.env.SWAGGER_PATH || 'docs',
  },
  logging: {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | 'verbose') || 'info',
    format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'simple',
    filename: process.env.LOG_FILENAME,
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'),
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
  },
  health: {
    enabled: process.env.HEALTH_ENABLED !== 'false',
    path: process.env.HEALTH_PATH || 'health',
    timeout: parseInt(process.env.HEALTH_TIMEOUT || '10000'), // 10 seconds
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsPath: process.env.METRICS_PATH || 'metrics',
    interval: parseInt(process.env.MONITORING_INTERVAL || '60000'), // 1 minute
  },
  gracefulShutdown: {
    timeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'), // 30 seconds
    signals: (process.env.GRACEFUL_SHUTDOWN_SIGNALS || 'SIGTERM,SIGINT').split(','),
  },
}); 