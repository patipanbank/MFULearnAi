"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const config_service_1 = require("./config/config.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_service_1.ConfigService);
    app.enableCors({
        origin: configService.corsOrigin,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = configService.port;
    await app.listen(port);
    console.log('🚀 NestJS Backend Started');
    console.log(`📡 Port: ${port}`);
    console.log(`🌐 CORS Origin: ${configService.corsOrigin}`);
    console.log(`💾 MongoDB: ${configService.mongoUri}`);
    console.log(`📮 Redis: ${configService.redisHost}:${configService.redisPort}`);
    console.log(`🔐 JWT Secret: ${configService.jwtSecret ? '***' : 'Not Set'}`);
    console.log(`🎯 AWS Region: ${configService.awsRegion}`);
    console.log(`📊 ChromaDB: ${configService.chromaUrl}`);
    console.log(`📚 Environment: ${configService.nodeEnv}`);
    console.log(`🔗 Frontend URL: ${configService.frontendUrl}`);
    console.log('🔐 SAML Configuration:');
    console.log(`   SP Entity ID: ${configService.samlSpEntityId ? '✅ Set' : '❌ Missing'}`);
    console.log(`   IDP SSO URL: ${configService.samlIdpSsoUrl ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Certificate: ${configService.samlCertificate ? '✅ Set' : '❌ Missing'}`);
}
bootstrap();
//# sourceMappingURL=main.js.map