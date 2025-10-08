import { Application, Request } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import config from '../config/config';
import { authenticateJWT, optionalAuth } from '../middleware/auth';
import {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  heavyLimiter,
} from '../middleware/rateLimit';

/**
 * Proxy configuration helper
 * Attaches user info to proxy headers for downstream services
 */
const createProxyConfig = (target: string, additionalOptions?: Partial<Options>): Options => {
  return {
    target,
    changeOrigin: true,
    onProxyReq: (proxyReq, req: Request) => {
      // Attach user info to headers for downstream services
      if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.userId);
        proxyReq.setHeader('x-user-email', req.user.email);
        if (req.user.role) {
          proxyReq.setHeader('x-user-role', req.user.role);
        }
        if (req.user.departmentId) {
          proxyReq.setHeader('x-user-department-id', req.user.departmentId);
        }
        // Send full user info as JSON for complex use cases
        proxyReq.setHeader('x-user-info', JSON.stringify(req.user));
      }

      // Log proxy requests in development
      if (config.env === 'development') {
        console.log(`[Proxy] ${req.method} ${req.path} -> ${target}${req.path}`);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Log proxy responses in development
      if (config.env === 'development') {
        console.log(`[Proxy Response] ${proxyRes.statusCode} from ${target}`);
      }
    },
    onError: (err, req, res) => {
      console.error(`[Proxy Error] ${err.message} for ${target}`);
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'The service is temporarily unavailable. Please try again later.',
        service: target,
      });
    },
    ...additionalOptions,
  };
};

/**
 * Configure all proxy routes
 */
export const configureRoutes = (app: Application): void => {
  // ============================================
  // PUBLIC ROUTES (No Authentication Required)
  // ============================================

  // Auth Service - Login, Register, Password Reset
  app.use(
    '/api/auth',
    authLimiter,
    createProxyMiddleware(createProxyConfig(config.services.auth))
  );

  // Health check endpoint (no auth, no rate limit)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: '1.0.0',
    });
  });

  // ============================================
  // PROTECTED ROUTES (Authentication Required)
  // ============================================

  // Department Service
  app.use(
    '/api/departments',
    authenticateJWT,
    apiLimiter,
    createProxyMiddleware(createProxyConfig(config.services.department))
  );

  // Chat Service (with WebSocket support)
  app.use(
    '/api/chat',
    authenticateJWT,
    apiLimiter,
    createProxyMiddleware(
      createProxyConfig(config.services.chat, {
        ws: true, // Enable WebSocket proxying
      })
    )
  );

  // WebSocket endpoint for real-time chat
  app.use(
    '/ws',
    authenticateJWT,
    createProxyMiddleware(
      createProxyConfig(config.services.chat, {
        ws: true,
        pathRewrite: { '^/ws': '/ws' },
      })
    )
  );

  // Agent Service
  app.use(
    '/api/agents',
    authenticateJWT,
    apiLimiter,
    createProxyMiddleware(createProxyConfig(config.services.agent))
  );

  // RAG Service - ChromaDB operations
  app.use(
    '/api/chroma',
    authenticateJWT,
    apiLimiter,
    createProxyMiddleware(
      createProxyConfig(config.services.rag, {
        pathRewrite: { '^/api/chroma': '/api/chroma' },
      })
    )
  );

  // RAG Service - Embedding operations (heavy compute)
  app.use(
    '/api/embedding',
    authenticateJWT,
    heavyLimiter,
    createProxyMiddleware(createProxyConfig(config.services.rag))
  );

  // RAG Service - Collections management
  app.use(
    '/api/collections',
    authenticateJWT,
    apiLimiter,
    createProxyMiddleware(createProxyConfig(config.services.rag))
  );

  // Training Service - Model training operations (heavy compute)
  app.use(
    '/api/training',
    authenticateJWT,
    heavyLimiter,
    createProxyMiddleware(createProxyConfig(config.services.training))
  );

  // Training Service - Queue management
  app.use(
    '/api/queue',
    authenticateJWT,
    apiLimiter,
    createProxyMiddleware(createProxyConfig(config.services.training))
  );

  // Storage Service - File uploads (rate limited separately)
  app.use(
    '/api/upload',
    authenticateJWT,
    uploadLimiter,
    createProxyMiddleware(createProxyConfig(config.services.storage))
  );

  // Storage Service - File downloads and management
  app.use(
    '/api/files',
    authenticateJWT,
    apiLimiter,
    createProxyMiddleware(createProxyConfig(config.services.storage))
  );

  // Bedrock Gateway - AWS Bedrock AI operations (heavy compute)
  app.use(
    '/api/bedrock',
    authenticateJWT,
    heavyLimiter,
    createProxyMiddleware(
      createProxyConfig(config.services.bedrock, {
        pathRewrite: { '^/api/bedrock': '/' },
      })
    )
  );

  // ============================================
  // CATCH-ALL & ERROR HANDLING
  // ============================================

  // 404 handler for unknown routes
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
      availableRoutes: [
        '/api/auth',
        '/api/departments',
        '/api/chat',
        '/api/agents',
        '/api/chroma',
        '/api/embedding',
        '/api/collections',
        '/api/training',
        '/api/queue',
        '/api/upload',
        '/api/files',
        '/api/bedrock',
        '/health',
      ],
    });
  });
};
