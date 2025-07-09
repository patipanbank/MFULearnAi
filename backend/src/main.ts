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
  
  // Set global prefix for all API routes
  app.setGlobalPrefix('api');
  
  // Enable API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v'
  });
  
  // Security Headers (first priority)
  app.use(SecurityHeadersPresets.api());
  
  // Response Caching (second priority)
  app.use('/api/v1/collections', CachePresets.longTerm());
  app.use('/api/v1/departments', CachePresets.longTerm());
  app.use('/api/v1/system-prompts', CachePresets.mediumTerm());
  app.use('/health', CachePresets.shortTerm());
  
  // Rate Limiting (third priority)
  // SAML endpoints need more lenient rate limiting due to redirects
  app.use('/api/v1/auth/login/saml', RateLimitPresets.saml());
  app.use('/api/v1/auth/saml', RateLimitPresets.saml());
  app.use('/api/v1/auth/logout/saml', RateLimitPresets.saml());
  app.use('/api/v1/auth/metadata', RateLimitPresets.saml());
  // Other auth endpoints use strict rate limiting
  app.use('/api/v1/auth', RateLimitPresets.auth());
  app.use('/api/v1/chat', RateLimitPresets.chat());
  app.use('/api/v1/upload', RateLimitPresets.upload());
  app.use('/api/v1/admin', RateLimitPresets.admin());
  app.use('/health', RateLimitPresets.health());
  app.use('/api', RateLimitPresets.api());
  
  // Global Pipes
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    }
  }));

  // Global Filters (order matters - more specific first)
  app.useGlobalFilters(
    new ZodErrorFilter(),
    new GlobalExceptionFilter()
  );

  // Global Interceptors
  app.useGlobalInterceptors(DynamicTimeout());

  // CORS Configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-API-Key'],
  });

  // Swagger Documentation
  const docConfig = new DocumentBuilder()
    .setTitle('MFU Learn AI (Node Backend)')
    .setVersion('0.1')
    .setDescription('Advanced AI Learning Platform API')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Chat', 'Chat and messaging functionality')
    .addTag('Agents', 'AI Agent management')
    .addTag('Collections', 'Document collections and knowledge base')
    .addTag('Upload', 'File upload and management')
    .addTag('Admin', 'Administrative functions')
    .addTag('Health', 'Health checks and monitoring')
    .build();
  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('docs', app, document);

  const PORT = process.env.PORT || 5000;
  await app.listen(PORT as number, '0.0.0.0');

  // Initialize graceful shutdown
  const gracefulShutdown = app.get(GracefulShutdownService);
  app.enableShutdownHooks();
  
  // eslint-disable-next-line no-console
  console.log(`🚀 Backend-Node service listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
  // eslint-disable-next-line no-console
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  // eslint-disable-next-line no-console
  console.log(`🛡️  Error handling and graceful shutdown enabled`);
}

bootstrap(); 