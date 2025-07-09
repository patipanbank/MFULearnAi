"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const security_headers_middleware_1 = require("./common/security-headers.middleware");
const rate_limit_middleware_1 = require("./common/rate-limit.middleware");
const cache_middleware_1 = require("./common/cache.middleware");
const zod_error_filter_1 = require("./common/zod-error.filter");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
const timeout_interceptor_1 = require("./common/interceptors/timeout.interceptor");
const graceful_shutdown_service_1 = require("./common/services/graceful-shutdown.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api', {
        exclude: [
            'health',
            'health/detailed',
            'metrics',
            'docs',
            'docs-json'
        ]
    });
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: '1',
        prefix: 'v'
    });
    app.use(security_headers_middleware_1.SecurityHeadersPresets.api());
    app.use('/api/v1/departments', cache_middleware_1.CachePresets.longTerm());
    app.use('/api/v1/collections', cache_middleware_1.CachePresets.longTerm());
    app.use('/api/v1/system-prompts', cache_middleware_1.CachePresets.mediumTerm());
    app.use('/health', cache_middleware_1.CachePresets.shortTerm());
    app.use('/metrics', cache_middleware_1.CachePresets.shortTerm());
    app.use('/api/v1/auth/login', rate_limit_middleware_1.RateLimitPresets.strictAuth());
    app.use('/api/v1/auth/refresh', rate_limit_middleware_1.RateLimitPresets.strictAuth());
    app.use('/api/v1/auth/login/saml', rate_limit_middleware_1.RateLimitPresets.saml());
    app.use('/api/v1/auth/saml', rate_limit_middleware_1.RateLimitPresets.saml());
    app.use('/api/v1/auth/logout/saml', rate_limit_middleware_1.RateLimitPresets.saml());
    app.use('/api/v1/auth/metadata', rate_limit_middleware_1.RateLimitPresets.saml());
    app.use('/api/v1/auth', rate_limit_middleware_1.RateLimitPresets.auth());
    app.use('/api/v1/chat', rate_limit_middleware_1.RateLimitPresets.chat());
    app.use('/api/v1/upload', rate_limit_middleware_1.RateLimitPresets.upload());
    app.use('/api/v1/admin', rate_limit_middleware_1.RateLimitPresets.admin());
    app.use('/api', rate_limit_middleware_1.RateLimitPresets.api());
    app.use('/health', rate_limit_middleware_1.RateLimitPresets.health());
    app.use('/metrics', rate_limit_middleware_1.RateLimitPresets.monitoring());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
            enableImplicitConversion: true,
        }
    }));
    app.useGlobalFilters(new zod_error_filter_1.ZodErrorFilter(), new global_exception_filter_1.GlobalExceptionFilter());
    app.useGlobalInterceptors((0, timeout_interceptor_1.DynamicTimeout)());
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
    const docConfig = new swagger_1.DocumentBuilder()
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
    const document = swagger_1.SwaggerModule.createDocument(app, docConfig);
    swagger_1.SwaggerModule.setup('docs', app, document, {
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
    const PORT = parseInt(process.env.PORT || '5000', 10);
    const HOST = process.env.HOST || '0.0.0.0';
    await app.listen(PORT, HOST);
    const gracefulShutdown = app.get(graceful_shutdown_service_1.GracefulShutdownService);
    app.enableShutdownHooks();
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
//# sourceMappingURL=main.js.map