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
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: '1',
        prefix: 'v'
    });
    app.use(security_headers_middleware_1.SecurityHeadersPresets.api());
    app.use('/api/v1/collections', cache_middleware_1.CachePresets.longTerm());
    app.use('/api/v1/departments', cache_middleware_1.CachePresets.longTerm());
    app.use('/api/v1/system-prompts', cache_middleware_1.CachePresets.mediumTerm());
    app.use('/health', cache_middleware_1.CachePresets.shortTerm());
    app.use('/api/auth', rate_limit_middleware_1.RateLimitPresets.auth());
    app.use('/api/chat', rate_limit_middleware_1.RateLimitPresets.chat());
    app.use('/api/upload', rate_limit_middleware_1.RateLimitPresets.upload());
    app.use('/api/admin', rate_limit_middleware_1.RateLimitPresets.admin());
    app.use('/health', rate_limit_middleware_1.RateLimitPresets.health());
    app.use('/api', rate_limit_middleware_1.RateLimitPresets.api());
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
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-API-Key'],
    });
    const docConfig = new swagger_1.DocumentBuilder()
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
    const document = swagger_1.SwaggerModule.createDocument(app, docConfig);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const PORT = process.env.PORT || 5000;
    await app.listen(PORT, '0.0.0.0');
    const gracefulShutdown = app.get(graceful_shutdown_service_1.GracefulShutdownService);
    app.enableShutdownHooks();
    console.log(`🚀 Backend-Node service listening on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🛡️  Error handling and graceful shutdown enabled`);
}
bootstrap();
//# sourceMappingURL=main.js.map