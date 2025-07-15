import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: configService.corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
  
  // SAML Configuration Status
  console.log('🔐 SAML Configuration:');
  console.log(`   SP Entity ID: ${configService.samlSpEntityId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   IDP SSO URL: ${configService.samlIdpSsoUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Certificate: ${configService.samlCertificate ? '✅ Set' : '❌ Missing'}`);
}
bootstrap();
