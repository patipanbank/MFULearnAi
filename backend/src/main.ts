import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SecurityHeadersPresets } from './common/security-headers.middleware';
import { RateLimitPresets } from './common/rate-limit.middleware';
import { CachePresets } from './common/cache.middleware';
import { ApiVersioning } from './common/api-versioning';
import { ZodErrorFilter } from './common/zod-error.filter';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { DynamicTimeout } from './common/interceptors/timeout.interceptor';
import { GracefulShutdownService } from './common/services/graceful-shutdown.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ================================
  // 🏗️ API ARCHITECTURE SETUP
  // ================================
  
  // 1. Infrastructure Endpoints (No versioning, no rate limiting)
  // These are for system monitoring and should be accessible without restrictions
  
  // 2. Business API Endpoints with Global Prefix
  app.setGlobalPrefix('api', {
    exclude: [
      'health',           // Health checks (K8s/Docker health probes)
      'health/detailed',  // Detailed health for admin
      'metrics',          // Prometheus metrics
      'docs',            // API documentation
      'docs-json'        // Swagger JSON
    ]
  });
  
  // 3. Enable API Versioning for Business Logic Only
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v'
  });
  
  // ================================
  // 🛡️ SECURITY & MIDDLEWARE SETUP
  // ================================
  
  // Security Headers (Highest Priority)
  app.use(SecurityHeadersPresets.api());
  
  // ================================
  // 💾 RESPONSE CACHING STRATEGY
  // ================================
  
  // Static/Semi-static Content Caching
  app.use('/api/v1/departments', CachePresets.longTerm());
  app.use('/api/v1/collections', CachePresets.longTerm());
  app.use('/api/v1/system-prompts', CachePresets.mediumTerm());
  
  // Infrastructure Endpoints Caching
  app.use('/health', CachePresets.shortTerm());
  app.use('/metrics', CachePresets.shortTerm());
  
  // ================================
  // 🚦 SMART RATE LIMITING STRATEGY
  // ================================
  
  // 1. Authentication Endpoints (Most Restrictive)
  app.use('/api/v1/auth/login', RateLimitPresets.strictAuth());
  app.use('/api/v1/auth/refresh', RateLimitPresets.strictAuth());
  
  // 2. SAML Endpoints (Lenient for SSO flows)
  app.use('/api/v1/auth/login/saml', RateLimitPresets.saml());
  app.use('/api/v1/auth/saml', RateLimitPresets.saml());
  app.use('/api/v1/auth/logout/saml', RateLimitPresets.saml());
  app.use('/api/v1/auth/metadata', RateLimitPresets.saml());
  
  // 3. Other Auth Endpoints
  app.use('/api/v1/auth', RateLimitPresets.auth());
  
  // 4. Business Logic Endpoints
  app.use('/api/v1/chat', RateLimitPresets.chat());
  app.use('/api/v1/upload', RateLimitPresets.upload());
  app.use('/api/v1/admin', RateLimitPresets.admin());
  
  // 5. General API Rate Limiting (Catch-all)
  app.use('/api', RateLimitPresets.api());
  
  // 6. Infrastructure Endpoints (Very Lenient)
  app.use('/health', RateLimitPresets.health());
  app.use('/metrics', RateLimitPresets.monitoring());
  
  // ================================
  // 🔧 GLOBAL PIPES & VALIDATION
  // ================================
  
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    }
  }));

  // ================================
  // 🚨 GLOBAL ERROR HANDLING
  // ================================
  
  // Order matters - most specific filters first
  app.useGlobalFilters(
    new ZodErrorFilter(),
    new GlobalExceptionFilter()
  );

  // ================================
  // ⏱️ GLOBAL INTERCEPTORS
  // ================================
  
  app.useGlobalInterceptors(DynamicTimeout());

  // ================================
  // 🌐 CORS CONFIGURATION
  // ================================
  
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Accept', 
      'X-Requested-With', 
      'X-API-Key',
      'X-User-Agent',
      'X-Request-ID'
    ],
  });

  // ================================
  // 📚 API DOCUMENTATION
  // ================================
  
  const docConfig = new DocumentBuilder()
    .setTitle('MFU Learn AI - Enterprise API')
    .setVersion('1.0.0')
    .setDescription(`
      🤖 Advanced AI Learning Platform API
      
      ## 🏗️ Architecture Overview
      - **Business APIs**: /api/v1/* (Versioned, rate-limited, authenticated)
      - **Health Checks**: /health (System monitoring)
      - **Metrics**: /metrics (Prometheus monitoring)
      
      ## 🔐 Authentication
      - JWT Bearer tokens for API access
      - SAML SSO for user authentication
      - Role-based access control (RBAC)
      
      ## 🚦 Rate Limiting
      - Authentication: 5 requests/15min
      - Chat: 30 requests/min
      - Upload: 10 requests/min
      - Admin: 200 requests/min
    `)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT Token',
      description: 'Enter your JWT token'
    })
    .addTag('🔐 Authentication', 'User authentication and authorization')
    .addTag('💬 Chat', 'Chat and messaging functionality')
    .addTag('🤖 Agents', 'AI Agent management and execution')
    .addTag('📚 Collections', 'Document collections and knowledge base')
    .addTag('📤 Upload', 'File upload and management')
    .addTag('⚙️ Admin', 'Administrative functions and system management')
    .addTag('🏥 Health', 'System health checks and monitoring')
    .addTag('📊 Stats', 'Analytics and usage statistics')
    .build();
    
  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'MFU Learn AI - API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .topbar-wrapper img { height: 40px; width: auto; }
      .swagger-ui .topbar { background-color: #1e293b; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  });

  // ================================
  // 🚀 SERVER STARTUP
  // ================================
  
  const PORT = parseInt(process.env.PORT || '5000', 10);
  const HOST = process.env.HOST || '0.0.0.0';
  
  await app.listen(PORT, HOST);

  // Initialize graceful shutdown
  const gracefulShutdown = app.get(GracefulShutdownService);
  app.enableShutdownHooks();
  
  // ================================
  // 📋 STARTUP LOGGING
  // ================================
  
  console.log('');
  console.log('🚀 ===================================');
  console.log('🤖 MFU Learn AI - Backend Service');
  console.log('🚀 ===================================');
  console.log(`📡 Server: http://${HOST}:${PORT}`);
  console.log(`📚 API Docs: http://${HOST}:${PORT}/docs`);
  console.log(`🏥 Health: http://${HOST}:${PORT}/health`);
  console.log(`📊 Metrics: http://${HOST}:${PORT}/metrics`);
  console.log('🚀 ===================================');
  console.log('✅ All systems operational');
  console.log('🛡️ Security, rate limiting, and monitoring enabled');
  console.log('');
}

bootstrap(); 