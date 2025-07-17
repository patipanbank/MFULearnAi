import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WebSocketServer } from 'ws';
import * as http from 'http';
import { verify } from 'jsonwebtoken';
import { ChatHistoryService } from './chat/chat-history.service';
import { AuthService } from './auth/auth.service';
import { ConfigService } from './config/config.service';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configure body parsing for SAML responses
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.json({ limit: '10mb' }));

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: configService.corsOrigin || 'https://mfulearnai.mfu.ac.th',
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

  // --- WebSocket (ws) server for /ws ---
  const server = app.getHttpServer();
  const chatHistoryService = app.get(ChatHistoryService);
  const authService = app.get(AuthService);
  const jwtSecret = configService.jwtSecret;

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (ws, req) => {
    try {
      // ดึง token จาก query string
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) {
        ws.close(4001, 'No token');
        return;
      }
      // verify JWT
      let payload: any;
      try {
        payload = verify(token, jwtSecret);
      } catch (e) {
        ws.close(4002, 'Invalid token');
        return;
      }
      // ดึง user จาก DB
      const user = await authService.getUserById(payload.sub);
      if (!user) {
        ws.close(4003, 'User not found');
        return;
      }
      ws.send(JSON.stringify({ type: 'connected', data: { userId: (user as any)._id?.toString(), username: user.username } }));
      // ตัวอย่าง: handle message event
      ws.on('message', async (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          // handle join_room, create_room, message ตาม logic เดิม
          // ...
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
        }
      });
    } catch (e) {
      ws.close(4000, 'Internal error');
    }
  });
  console.log('🟢 Native WebSocket server started at /ws');

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
